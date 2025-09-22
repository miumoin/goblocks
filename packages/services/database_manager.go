package services

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

type BlockType struct {
	ID         int
	Type       string // Changed 'type' to 'blockType' since 'type' is a reserved keyword
	Title      string
	Content    string
	Author     int
	Slug       string
	Parent     *int
	CreatedAt  time.Time
	ModifiedAt time.Time
	Status     int
	SystemID   int64
}

type DatabaseManager struct {
	db        *sql.DB
	domain    string
	accessKey string
	userID    int64
	systemID  int64
}

func NewDatabaseManager(db *sql.DB, domain, accessKey string) (*DatabaseManager, error) {
	dm := &DatabaseManager{
		db:        db,
		domain:    domain,
		accessKey: accessKey,
	}

	if domain == "" {
		dm.systemID = 0
	} else {
		systemID, err := dm.getSystemIDByDomain(domain)
		if err != nil {
			return nil, fmt.Errorf("failed to get system ID: %v", err)
		}
		dm.systemID = systemID
	}

	if accessKey == "" {
		dm.userID = 0
	} else {
		userID, err := dm.getUserIDByAccessKey(accessKey)
		if err != nil {
			return nil, fmt.Errorf("failed to get user ID: %v", err)
		}
		dm.userID = int64(userID)
	}

	return dm, nil
}

func (dm *DatabaseManager) GetCurrentUser() int64 {
	return dm.userID
}

func (dm *DatabaseManager) GetSystemID() int64 {
	return dm.systemID
}

func (dm *DatabaseManager) getUserIDByAccessKey(accessKey string) (int, error) {
	var userID int
	err := dm.db.QueryRow("SELECT id FROM users WHERE access_key = ?", accessKey).Scan(&userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, errors.New("user not found")
		}
		return 0, err
	}
	return userID, nil
}

func (dm *DatabaseManager) getSystemIDByDomain(domain string) (int64, error) {
	var systemID int64
	err := dm.db.QueryRow(
		"SELECT id FROM systems WHERE (subdomain = ? OR domain = ?) AND status = 1",
		domain, domain,
	).Scan(&systemID)

	if err == nil {
		return systemID, nil
	}

	if err != sql.ErrNoRows {
		return 0, err
	}

	result, err := dm.db.Exec(
		"INSERT INTO systems (subdomain, domain, status) VALUES (?, ?, 1)",
		domain, domain,
	)
	if err != nil {
		return 0, err
	}

	newID, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}

	return newID, nil
}

func (dm *DatabaseManager) AddUser(email, password string) (int64, error) {
	var id int64
	err := dm.db.QueryRow("SELECT id FROM users WHERE email = ?", email).Scan(&id)
	if err != nil {
		return 0, err
	}

	if id > 0 {
		return id, errors.New("user already exists")
	}

	accessKey := uuid.New().String()
	result, err := dm.db.Exec(
		"INSERT INTO users (email, password, access_key, system_id) VALUES (?, ?, ?, ?)",
		email, password, accessKey, dm.systemID,
	)
	if err != nil {
		return 0, err
	}

	userID, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}

	return userID, nil
}

func (dm *DatabaseManager) GetAccessKey(userID int64) ([]string, error) {
	var email, accessKey string
	err := dm.db.QueryRow(
		"SELECT email, access_key FROM users WHERE id = ?",
		userID,
	).Scan(&email, &accessKey)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return []string{email, accessKey}, nil
}

func (dm *DatabaseManager) AddMeta(parent string, parentID int64, metaKey string, metaValue interface{}) error {
	var value string
	switch v := metaValue.(type) {
	case string:
		value = v
	default:
		b, err := json.Marshal(v)
		if err != nil {
			return err
		}
		value = string(b)
	}

	var exists bool
	err := dm.db.QueryRow(
		"SELECT EXISTS(SELECT 1 FROM metas WHERE parent = ? AND parent_id = ? AND meta_key = ?)",
		parent, parentID, metaKey,
	).Scan(&exists)
	if err != nil {
		return err
	}

	if exists {
		_, err = dm.db.Exec(
			"UPDATE metas SET meta_value = ?, status = 1 WHERE parent = ? AND parent_id = ? AND meta_key = ?",
			value, parent, parentID, metaKey,
		)
	} else {
		_, err = dm.db.Exec(
			"INSERT INTO metas (parent, parent_id, meta_key, meta_value, status) VALUES (?, ?, ?, ?, 1)",
			parent, parentID, metaKey, value,
		)
	}
	return err
}

func (dm *DatabaseManager) GetMeta(parent string, parentID int, key string) (string, error) {
	var value string
	err := dm.db.QueryRow(
		"SELECT meta_value FROM metas WHERE parent = ? AND parent_id = ? AND meta_key = ? AND status = 1",
		parent, parentID, key,
	).Scan(&value)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", err
	}
	return value, nil
}

type Block struct {
	ID         int       `json:"id"`
	Type       string    `json:"type"`
	Title      string    `json:"title"`
	Content    string    `json:"content"`
	Author     int       `json:"author"`
	Slug       string    `json:"slug"`
	Parent     *int      `json:"parent"`
	CreatedAt  time.Time `json:"created_at"`
	ModifiedAt time.Time `json:"modified_at"`
}

func (dm *DatabaseManager) AddBlock(userID int64, block map[string]interface{}, slug string) (map[string]interface{}, error) {
	if slug == "" {
		slug = uuid.New().String()
	}

	var existingID int
	err := dm.db.QueryRow("SELECT id FROM blocks WHERE slug = ?", slug).Scan(&existingID)

	now := time.Now()
	if err == nil {
		_, err = dm.db.Exec(
			"UPDATE blocks SET title = ?, content = ?, modified_at = ? WHERE slug = ?",
			block["title"], block["content"], now, slug,
		)
		if err != nil {
			return nil, err
		}
	} else if err == sql.ErrNoRows {
		var parentPtr *int
		if parent, ok := block["parent"].(int); ok {
			parentPtr = &parent
		}
		_, err = dm.db.Exec(
			"INSERT INTO blocks (type, title, content, author, slug, parent, created_at, modified_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)",
			block["type"], block["title"], block["content"], userID, slug, parentPtr, now, now,
		)
		if err != nil {
			return nil, err
		}
	} else {
		return nil, err
	}

	var b Block
	err = dm.db.QueryRow(
		"SELECT id, type, title, content, author, slug, parent, created_at, modified_at FROM blocks WHERE slug = ? AND status = 1",
		slug,
	).Scan(&b.ID, &b.Type, &b.Title, &b.Content, &b.Author, &b.Slug, &b.Parent, &b.CreatedAt, &b.ModifiedAt)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"id":          b.ID,
		"type":        b.Type,
		"title":       b.Title,
		"content":     b.Content,
		"author":      b.Author,
		"slug":        b.Slug,
		"parent":      b.Parent,
		"created_at":  b.CreatedAt.Format("2006-01-02 15:04:05"),
		"modified_at": b.ModifiedAt.Format("2006-01-02 15:04:05"),
	}, nil
}

func (dm *DatabaseManager) GetBlocks(userID int64, blockType string, page, entriesPerPage, parent int) ([]map[string]interface{}, error) {
	offset := (page - 1) * entriesPerPage

	query := "SELECT id, type, title, content, author, slug, parent, created_at, modified_at FROM blocks WHERE ( author = ? OR id IN ( SELECT parent_id FROM metas WHERE parent = ? AND meta_key = ? ) ) ) AND type = ? AND status = 1"
	args := []interface{}{userID, blockType, blockType, "privilege_" + strconv.FormatInt(userID, 10)}

	if parent > 0 {
		query += " AND parent = ?"
		args = append(args, parent)
	}

	query += " ORDER BY id DESC LIMIT ? OFFSET ?"
	args = append(args, entriesPerPage, offset)

	rows, err := dm.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var blocks []map[string]interface{}
	for rows.Next() {
		var b Block
		err := rows.Scan(&b.ID, &b.Type, &b.Title, &b.Content, &b.Author, &b.Slug, &b.Parent, &b.CreatedAt, &b.ModifiedAt)
		if err != nil {
			log.Println(err)
			continue
		}
		blocks = append(blocks, map[string]interface{}{
			"id":          int64(b.ID),
			"type":        b.Type,
			"title":       b.Title,
			"content":     b.Content,
			"author":      int64(b.Author),
			"slug":        b.Slug,
			"parent":      b.Parent,
			"created_at":  b.CreatedAt.Format("2006-01-02 15:04:05"),
			"modified_at": b.ModifiedAt.Format("2006-01-02 15:04:05"),
			"metas":       map[string]string{},
		})
	}

	if len(blocks) == 0 {
		return nil, nil
	}

	return blocks, nil
}

func (dm *DatabaseManager) GetBlock(userID int64, blockType string, id int, slug string, parent int) (map[string]interface{}, error) {
	query := "SELECT id, type, title, content, author, slug, parent, created_at, modified_at FROM blocks WHERE status > 0 AND author = ?"
	args := []interface{}{userID}

	if blockType != "" {
		query += " AND type = ?"
		args = append(args, blockType)
	}
	if id > 0 {
		query += " AND id = ?"
		args = append(args, id)
	}
	if slug != "" {
		query += " AND slug = ?"
		args = append(args, slug)
	}
	if parent > 0 {
		query += " AND parent = ?"
		args = append(args, parent)
	}

	var b Block
	err := dm.db.QueryRow(query, args...).Scan(&b.ID, &b.Type, &b.Title, &b.Content, &b.Author, &b.Slug, &b.Parent, &b.CreatedAt, &b.ModifiedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	result := map[string]interface{}{
		"id":          b.ID,
		"type":        b.Type,
		"title":       b.Title,
		"content":     b.Content,
		"author":      b.Author,
		"slug":        b.Slug,
		"parent":      b.Parent,
		"created_at":  b.CreatedAt.Format("2006-01-02 15:04:05"),
		"modified_at": b.ModifiedAt.Format("2006-01-02 15:04:05"),
	}

	children, err := dm.GetBlocks(userID, "entry", 1, 999999, b.ID)
	if err == nil && children != nil {
		result["children"] = children
	}

	return result, nil
}

func (dm *DatabaseManager) DeleteBlock(id int) error {
	_, err := dm.db.Exec("UPDATE blocks SET status = 0 WHERE id = ?", id)
	return err
}

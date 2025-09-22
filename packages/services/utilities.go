package services

import (
	"bytes"
	"crypto/md5"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"math/rand"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
)

// Request wrapper for HTTP
type Request struct {
	*http.Request
}

// Workspace represents a workspace block
type Workspace struct {
	ID        int64             `json:"id"`
	Title     string            `json:"title"`
	Content   string            `json:"content"`
	Type      string            `json:"type"`
	Slug      string            `json:"slug"`
	Status    int               `json:"status"`
	CreatedAt time.Time         `json:"created_at"`
	Metas     map[string]string `json:"metas,omitempty"`
}

func (r *Request) GetContent() ([]byte, error) {
	return io.ReadAll(r.Body)
}

// Utilities struct (like your PHP class)
type Utilities struct {
	db *sql.DB
}

// Constructor equivalent
func NewUtilities(db *sql.DB) *Utilities {
	return &Utilities{
		db: db,
	}
}

// ---- Core Method ----
func (u *Utilities) MakeLogin(databaseManager DatabaseManager, c *gin.Context) (int64, string, string, error) {
	req := &Request{c.Request}

	// Parse JSON
	body, err := req.GetContent()
	if err != nil {
		return 0, "", "", err
	}

	var content map[string]interface{}
	if err := json.Unmarshal(body, &content); err != nil {
		return 0, "", "", err
	}

	// Generate password
	rand.Seed(time.Now().UnixNano())
	password := fmt.Sprintf("%06d", rand.Intn(900000)+100000)

	// Add user
	email := content["email"].(string)
	userID, err := databaseManager.AddUser(email, GetMD5Hash(password))

	if err != nil && userID == 0 {
		return 0, "", "", err
	}

	userEmail := email
	accessKey := ""

	// If Google login
	if _, hasAud := content["aud"]; hasAud {
		if _, hasAzp := content["azp"]; hasAzp {
			emailAndKey, err := databaseManager.GetAccessKey(userID)
			if err != nil {
				return 0, "", "", err
			}
			userEmail, accessKey = emailAndKey[0], emailAndKey[1]
			if err != nil {
				return 0, "", "", err
			}
			return userID, userEmail, accessKey, nil
		}
	}

	fmt.Println("Register without google: ", userEmail)

	// Otherwise send verification code
	meta := map[string]interface{}{
		"timestamp": time.Now().Format(time.RFC3339),
		"code":      password,
	}
	if err := databaseManager.AddMeta("user", userID, "validation_key", meta); err != nil {
		return 0, "", "", err
	}

	subject := "Your Login Verification Code"
	messagePlain := fmt.Sprintf(`Hi there,

Your login verification code is: %s

Please enter this code to verify your email and access your account.

If you didn't request this, please ignore this email.

Thanks,
The Typewriting Team`, password)

	messageHTML := fmt.Sprintf(`<p>Hi there,</p>
<p>Your login verification code is:</p>
<h1 style="color: #007bff;">%s</h1>
<p>Please enter this code to verify your email and access your account.</p>
<p>If you didn't request this, please ignore this email.</p>
<br>
<p>Thanks,<br>The Typewriting Team</p>`, password)

	// Placeholder for email sending
	u.SendEmail(userEmail, subject, messagePlain, messageHTML)

	return userID, userEmail, accessKey, nil
}

func GetMD5Hash(text string) string {
	hash := md5.Sum([]byte(text))
	return hex.EncodeToString(hash[:])
}

// GetWorkspaces returns a paginated list of workspaces with privilege filtering
func (u *Utilities) GetWorkspaces(databaseManager DatabaseManager, page int) ([]Workspace, int, error) {
	userID := databaseManager.GetCurrentUser()
	limit := 999
	if page > 0 {
		limit = 20
	}

	blocks, err := databaseManager.GetBlocks(userID, "workspaces", page, limit, 0)
	if err != nil {
		return nil, 0, err
	}

	workspaces := make([]Workspace, len(blocks))
	for i := range blocks {
		metas, err := u.GetWorkspaceMetas("workspace", blocks[i]["id"].(int64), []string{"description", "logo"})
		if err != nil {
			return nil, 0, err
		}
		workspaces[i] = Workspace{
			ID:      blocks[i]["id"].(int64),
			Title:   blocks[i]["title"].(string),
			Content: blocks[i]["content"].(string),
			Type:    blocks[i]["type"].(string),
			Status:  blocks[i]["status"].(int),
			Metas:   metas,
		}
	}

	return workspaces, limit, nil
}

// GetWorkspace returns a single workspace with all its metas if user has privileges
func (u *Utilities) GetWorkspace(slug string, databaseManager DatabaseManager) (*Workspace, error) {
	userID := databaseManager.GetCurrentUser()
	block, err := databaseManager.GetBlock(userID, "workspace", 0, slug, 0)
	var workspace *Workspace
	if err == nil && block != nil {
		workspace = &Workspace{
			ID:      block["id"].(int64),
			Title:   block["title"].(string),
			Content: block["content"].(string),
			Type:    block["type"].(string),
			Status:  block["status"].(int),
		}
	}
	if err != nil || workspace == nil {
		return nil, err
	}

	metas, err := u.GetWorkspaceMetas("workspace", workspace.ID, nil)
	if err != nil {
		return nil, err
	}
	if len(metas) > 0 {
		workspace.Metas = metas
	}

	return workspace, nil
}

func (u *Utilities) GetWorkspaceMetas(parent string, parentID int64, metaKeys []string) (map[string]string, error) {
	var query string
	if len(metaKeys) > 0 {
		query = "SELECT meta_key, meta_value FROM metas WHERE parent = ? AND parent_id = ? AND meta_key IN (?" + strings.Repeat(",?", len(metaKeys)-1) + ")"
	} else {
		query = "SELECT meta_key, meta_value FROM metas WHERE parent = ? AND parent_id = ?"
	}
	rows, err := u.db.Query(query, parent, parentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	metas := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		metas[key] = value
	}

	return metas, nil
}

// UpdateWorkspace updates a workspace and its metadata
func (u *Utilities) UpdateWorkspace(workspace Workspace, req *Request, databaseManager DatabaseManager) (Workspace, error) {
	body, err := req.GetContent()
	if err != nil {
		return Workspace{}, err
	}

	var content map[string]interface{}
	if err := json.Unmarshal(body, &content); err != nil {
		return Workspace{}, err
	}

	userID := databaseManager.GetCurrentUser()

	if title, ok := content["title"].(string); ok {
		workspace.Title = title
	}

	if content, ok := content["content"].(string); ok {
		workspace.Content = content
	}

	if slug, ok := content["slug"].(string); ok {
		workspace.Slug = slug
	}

	if typ, ok := content["type"].(string); ok {
		workspace.Type = typ
	}

	if status, ok := content["status"].(float64); ok {
		workspace.Status = int(status)
	}

	w := map[string]interface{}{
		"id":      workspace.ID,
		"title":   workspace.Title,
		"content": workspace.Content,
		"type":    workspace.Type,
		"slug":    workspace.Slug,
		"status":  workspace.Status,
	}

	result, err := databaseManager.AddBlock(userID, w, workspace.Slug)
	if err != nil {
		return Workspace{}, err
	}

	workspace = Workspace{
		ID:      result["id"].(int64),
		Title:   result["title"].(string),
		Content: result["content"].(string),
		Type:    result["type"].(string),
		Status:  result["status"].(int),
	}

	// optional fields
	metaFields := []string{"prompt", "description", "role", "tone", "collect_information", "questionnaire"}
	for _, field := range metaFields {
		val := ""
		if v, ok := content[field].(string); ok {
			val = v
		}
		_ = databaseManager.AddMeta("workspace", workspace.ID, field, val)
	}

	return workspace, nil
}

// Add this function to the utilities.go file
func (u *Utilities) uniqid() string {
	now := time.Now()
	return fmt.Sprintf("%010x", now.UnixNano()%0x100000000)
}

// AddNewProfile inserts a new thread block
func (u *Utilities) AddNewProfile(workspaceID, userID int, r *http.Request) (bool, error) {
	var content map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&content); err != nil {
		return false, err
	}

	title := "Untitled"
	if val, ok := content["title"].(string); ok && val != "" {
		title = val
	}

	slug := u.uniqid()
	existingID := 0
	err := u.db.QueryRow("SELECT id FROM blocks WHERE slug = ?", slug).Scan(&existingID)
	if err != sql.ErrNoRows && err != nil {
		return false, err
	}

	_, err = u.db.Exec("INSERT INTO blocks (type, title, content, parent, user_id) VALUES (?, ?, ?, ?, ?)",
		"thread", title, "", workspaceID, userID)

	if err != nil {
		return false, err
	}
	return true, nil
}

// DeleteProfile removes a block by ID
func (u *Utilities) DeleteProfile(r *http.Request) error {
	var content map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&content); err != nil {
		return err
	}

	id, ok := content["id"].(float64)
	if !ok {
		return sql.ErrNoRows
	}

	_, err := u.db.Exec("DELETE FROM blocks WHERE id = ?", id)
	if err != nil {
		return err
	}

	return err
}

// GetWorkspaceProfile fetches a thread block + its collected info
func (u *Utilities) GetWorkspaceProfile(workspaceID int, slug string) (*map[string]interface{}, error) {
	var profile Block

	err := u.db.QueryRow(
		"SELECT b.id, b.title, b.slug FROM blocks b WHERE b.slug = ? AND b.type = ? AND b.parent = ? LIMIT 1",
		slug, "thread", workspaceID,
	).Scan(&profile.ID, &profile.Title, &profile.Slug)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	// fetch collected_information
	var collectedInfo sql.NullString
	err = u.db.QueryRow(
		"SELECT meta_value FROM metas WHERE parent_id = ? AND parent = ? AND meta_key = ? LIMIT 1",
		profile.ID, "thread", "collected_information",
	).Scan(&collectedInfo)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	var info map[string]interface{}
	if collectedInfo.Valid {
		if err := json.Unmarshal([]byte(collectedInfo.String), &info); err != nil {
			return nil, err
		}
	} else {
		info = map[string]interface{}{}
	}

	result := map[string]interface{}{
		"id":                    profile.ID,
		"title":                 profile.Title,
		"slug":                  profile.Slug,
		"collected_information": info,
	}

	return &result, nil
}

// ------------------------------------------------------------------
// GetProfile
// ------------------------------------------------------------------
func (u *Utilities) GetProfile(slug string) (map[string]interface{}, error) {
	var (
		id      int
		parent  int
		author  int
		title   string
		slugOut string
	)

	err := u.db.QueryRow(
		"SELECT b.id, b.title, b.slug, b.parent, b.author FROM blocks b WHERE b.slug = ? AND b.type = ? AND b.status = ? LIMIT 1",
		slug, "thread", 1,
	).Scan(&id, &title, &slugOut, &parent, &author)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	profile := map[string]interface{}{
		"id":     id,
		"title":  title,
		"slug":   slugOut,
		"parent": parent,
		"author": author,
	}

	return profile, nil
}

// ------------------------------------------------------------------
// SplitText splits text into chunks (e.g., 256 chars, min 200)
// ------------------------------------------------------------------
func (u *Utilities) SplitText(text string, chunkSize int, minSize int) []string {
	if chunkSize == 0 {
		chunkSize = 256
	}
	if minSize == 0 {
		minSize = 200
	}

	// Split on period followed by space
	re := regexp.MustCompile(`(?m)([^.]+\.?)\s*`)
	matches := re.FindAllString(text, -1)

	var chunks []string
	var currentChunk string

	for _, sentence := range matches {
		sentence = strings.TrimSpace(sentence)
		if len(currentChunk)+len(sentence) < minSize {
			if currentChunk != "" {
				currentChunk += " "
			}
			currentChunk += sentence
		} else {
			if currentChunk != "" {
				chunks = append(chunks, strings.TrimSpace(currentChunk))
			}
			currentChunk = sentence
		}
	}

	if currentChunk != "" {
		chunks = append(chunks, strings.TrimSpace(currentChunk))
	}

	return chunks
}

// ------------------------------------------------------------------
// CleanText removes non-ASCII, normalizes spaces, ensures UTF-8
// ------------------------------------------------------------------
func (u *Utilities) CleanText(text string) string {
	// Force UTF-8 validity
	if !utf8.ValidString(text) {
		text = string([]rune(text))
	}

	// Remove non-ASCII characters
	re := regexp.MustCompile(`[^\x20-\x7E]`)
	text = re.ReplaceAllString(text, " ")

	// Normalize multiple spaces
	reSpaces := regexp.MustCompile(`\s+`)
	text = reSpaces.ReplaceAllString(text, " ")

	return strings.TrimSpace(text)
}

// -----------------------------
// Cosine similarity helper
// -----------------------------
func (u *Utilities) CosineSimilarity(vecA, vecB []float64) float64 {
	if len(vecA) != len(vecB) {
		return 0
	}
	var dot, magA, magB float64
	for i := 0; i < len(vecA); i++ {
		dot += vecA[i] * vecB[i]
		magA += vecA[i] * vecA[i]
		magB += vecB[i] * vecB[i]
	}
	if magA == 0 || magB == 0 {
		return 0
	}
	return dot / (math.Sqrt(magA) * math.Sqrt(magB))
}

// -----------------------------
// Helper to convert []interface{} to []float64
// -----------------------------
func (u *Utilities) convertInterfaceSliceToFloat64(slice []interface{}) []float64 {
	out := make([]float64, len(slice))
	for i, v := range slice {
		out[i] = v.(float64)
	}
	return out
}

// Placeholder for atoi
func (u *Utilities) atoi(s string) int {
	var i int
	fmt.Sscanf(s, "%d", &i)
	return i
}

// -----------------------------
// Helper to truncate string
// -----------------------------
func (u *Utilities) truncateString(str string, max int) string {
	if len(str) > max {
		return str[:max]
	}
	return str
}

// -----------------------------
// Send email via Mailjet
// -----------------------------
func (u *Utilities) SendEmail(recipient, subject, messagePlain, messageHTML string) error {
	apiKey := os.Getenv("MAILJET_API_KEY")
	apiSecret := os.Getenv("MAILJET_API_SECRET")
	senderEmail := os.Getenv("MAILJET_SENDER_EMAIL")
	senderName := os.Getenv("MAILJET_SENDER")

	body := map[string]interface{}{
		"Messages": []map[string]interface{}{
			{
				"From": map[string]string{
					"Email": senderEmail,
					"Name":  senderName,
				},
				"To": []map[string]string{
					{"Email": recipient},
				},
				"Subject":  subject,
				"TextPart": messagePlain,
				"HTMLPart": messageHTML,
			},
		},
	}

	jsonBody, _ := json.Marshal(body)
	req, err := http.NewRequest("POST", "https://api.mailjet.com/v3.1/send", bytes.NewBuffer(jsonBody))
	if err != nil {
		return err
	}

	req.SetBasicAuth(apiKey, apiSecret)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	return fmt.Errorf("failed to send email, status code: %d", resp.StatusCode)
}

// -----------------------------
// Get subscription info for a user
// -----------------------------
func (u *Utilities) GetSubscriptionInfo(db *sql.DB, userID int64) (map[string]interface{}, error) {
	subscription := make(map[string]interface{})
	subscription["user_id"] = userID

	var subscriptionJSON string
	err := db.QueryRow("SELECT meta_value FROM metas WHERE parent='user' AND parent_id=? AND meta_key='subscription'", userID).Scan(&subscriptionJSON)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	if subscriptionJSON != "" {
		_ = json.Unmarshal([]byte(subscriptionJSON), &subscription)
	} else {
		subscription["expiry_date"] = ""
	}

	// Count threads for the user
	var threadsCount int
	query := `
		SELECT COUNT(t.id)
		FROM blocks t
		INNER JOIN blocks w ON t.parent = w.id
		WHERE t.type='thread' AND t.status=1
		AND w.type='workspace' AND w.status=1
		AND w.author=?
	`
	err = db.QueryRow(query, userID).Scan(&threadsCount)
	if err != nil {
		return nil, err
	}

	subscription["threads"] = threadsCount
	return subscription, nil
}

// -----------------------------
// Get subscriber user ID by Stripe customer and subscription ID
// -----------------------------
func (u *Utilities) GetSubscriberUserID(db *sql.DB, customerID, subscriptionID string) (int, error) {
	var parentID int
	query := `
		SELECT parent_id
		FROM metas
		WHERE parent='user' AND meta_key='subscription'
		AND meta_value LIKE ? AND meta_value LIKE ?
		LIMIT 1
	`
	err := db.QueryRow(query, "%"+customerID+"%", "%"+subscriptionID+"%").Scan(&parentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, nil // Not found
		}
		return 0, err
	}

	return parentID, nil
}

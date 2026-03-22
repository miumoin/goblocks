package controllers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/miumoin/agencybot/packages/services"
)

type ApiController struct {
	db     *sql.DB
	router *gin.Engine
}

func NewApiController(
	db *sql.DB,
	router *gin.Engine,
) *ApiController {
	return &ApiController{
		db:     db,
		router: router,
	}
}

func (ac *ApiController) RegisterApiRoutes() {
	apiGroup := ac.router.Group("/api")
	{
		apiGroup.POST("/login", ac.Login)
		apiGroup.GET("/googleAuth/init", ac.initGoogleAuth)
		apiGroup.GET("/googleAuth/callback", ac.handleGoogleAuthCallback)
		apiGroup.POST("/verify", ac.Verify)
		apiGroup.POST("/initWorker", ac.InitWorker)
		apiGroup.POST("/startProject", ac.StartProject)
		apiGroup.GET("/activeWorks", ac.GetActiveWorks)
		apiGroup.GET("/projects/:page_no", ac.GetProjects)
		apiGroup.GET("/history/:page_no", ac.GetWorkHistory)
		apiGroup.POST("/terminateMember", ac.TerminateMember)
		apiGroup.POST("/terminateProject", ac.TerminateProject)
		apiGroup.POST("/leaveProject", ac.LeaveProject)
		apiGroup.GET("/getPendingPay", ac.GetPendingPay)
		apiGroup.POST("/markPaid", ac.MarkPaid)
		/*apiGroup.GET("/profile", ac.GetProfile)
		apiGroup.POST("/terminateWorker", ac.TerminateWorker)
		apiGroup.GET("/terminateProject", ac.TerminateProject)
		apiGroup.GET("/getEmployerDues", ac.GetEmployerDues)
		apiGroup.GET("/getWorkerDues", ac.GetWorkerDues)
		apiGroup.POST("/completeWorkerDues", ac.CompleteWorkerDues)*/
		apiGroup.GET("/welcome", ac.ApiWelcome)
	}
}

// GetInstallationURL handles the installation URL request
func (ac *ApiController) ApiWelcome(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"text":   "Welcome to the Shopify Quote Offer API!",
	})
}

func (ac *ApiController) Login(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")

	databaseManager, err := services.NewDatabaseManager(ac.db, domain, accessKey)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":     "fail",
			"access_key": "",
		})
		return
	}

	// Note: DatabaseManager and utilities.makeLogin implementation needed
	utils := services.NewUtilities(ac.db)
	userID, userEmail, newAccessKey, name, picture, err := utils.MakeLogin(*databaseManager, c)
	if err == nil && userEmail != "" {
		fmt.Println("User logged in: ", userEmail)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     map[bool]string{true: "success", false: "fail"}[userID > 0],
		"access_key": newAccessKey,
		"user_id":    userID,
		"name":       name,
		"picture":    picture,
	})
}

func (ac *ApiController) Verify(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")

	databaseManager, err := services.NewDatabaseManager(ac.db, domain, accessKey)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":     "fail",
			"access_key": "",
		})
		return
	}

	var content struct {
		Code string `json:"code"`
	}

	if err := c.BindJSON(&content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail"})
		return
	}

	var userID int64 = 0
	var userEmail string = ""

	row := ac.db.QueryRow(`
		SELECT m.parent_id
		FROM metas m
		WHERE m.meta_value LIKE ? AND m.meta_value LIKE ? 
	`, "%code%", "%"+content.Code+"%")

	if err := row.Scan(&userID); err == nil && userID > 0 {
		// Note: getAccessKey implementation needed
		emailAndKey, err := databaseManager.GetAccessKey(userID)
		if err != nil {
			return
		}
		userEmail, accessKey = emailAndKey[0], emailAndKey[1]
	}

	if userEmail == "" {
		userID = 0
		accessKey = ""
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     map[bool]string{true: "success", false: "fail"}[userID > 0],
		"access_key": accessKey,
		"email":      userEmail,
	})
}

func (ac *ApiController) GetWorkspaces(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	page, sErr := strconv.Atoi(c.Param("page_no"))
	if sErr != nil || page < 1 {
		page = 1
	}

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":     "fail",
			"workspaces": nil,
		})
		return
	}

	userID := databaseManager.GetCurrentUser()

	utils := services.NewUtilities(ac.db)

	//workspaces, limit, err := utils.GetWorkspaces(*databaseManager, 20)
	workspaces, err := databaseManager.GetBlocks(userID, "workspace", page, 20, 0)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":     "fail",
			"workspaces": nil,
		})
		return
	}

	subscription, sErr := utils.GetSubscriptionInfo(ac.db, userID)
	if sErr != nil {
		//do nothing
	}

	var workspacesOut []map[string]interface{}
	if workspaces == nil {
		workspacesOut = []map[string]interface{}{}
	} else {
		workspacesOut = workspaces
	}

	c.JSON(http.StatusOK, gin.H{
		"status":       "success",
		"workspaces":   workspacesOut,
		"limit":        20,
		"subscription": subscription,
	})
}

func (ac *ApiController) AddNewWorkspace(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")

	var content struct {
		Title string              `json:"title"`
		Metas map[string][]string `json:"metas"`
	}
	if err := c.BindJSON(&content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail"})
		return
	}

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":     "fail",
			"workspaces": nil,
		})
		return
	}

	userID := databaseManager.GetCurrentUser()

	blockData := map[string]interface{}{
		"type":    "workspace",
		"title":   content.Title,
		"content": "",
		"parent":  0,
	}

	block, err := databaseManager.AddBlock(userID, blockData, "")

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
			"block":  nil,
		})
		return
	}

	privileges := []string{"admin"}
	databaseManager.AddMeta("workspace", block["id"].(int64), fmt.Sprintf("privilege_%d", userID), privileges)

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"block":  block,
	})
}

func (ac *ApiController) DeleteWorkspace(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")

	var content struct {
		ID int64 `json:"id"`
	}
	if err := c.BindJSON(&content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail"})
		return
	}

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
		})
		return
	}

	userID := databaseManager.GetCurrentUser()
	privileges := string("")
	privileges, Merr := databaseManager.GetMeta("workspace", content.ID, fmt.Sprintf("privilege_%d", userID))
	if Merr != nil {
		//do nothing
	}

	// Note: deleteBlock implementation needed
	var deleted bool
	if privileges != "" {
		var privArray []string
		json.Unmarshal([]byte(privileges), &privArray)
		if contains(privArray, "admin") {
			err := databaseManager.DeleteBlock(content.ID)
			if err == nil {
				deleted = true
			} else {
				deleted = false
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": map[bool]string{true: "success", false: "fail"}[deleted],
	})
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func (ac *ApiController) GetWorkspace(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")
	page := c.Param("page")

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":     "fail",
			"workspaces": nil,
		})
		return
	}

	userID := databaseManager.GetCurrentUser()

	if slug != "" {
		workspace, err := databaseManager.GetBlock(userID, "workspace", 0, slug, 0)
		if workspace != nil && err == nil {
			c.JSON(http.StatusOK, gin.H{
				"status":    "success",
				"workspace": workspace,
				"page":      page,
				"limit":     20,
				"threads":   []map[string]interface{}{},
			})
		}
	} else {
		c.JSON(http.StatusOK, gin.H{
			"status":    "fail",
			"workspace": map[string]interface{}{},
			"threads":   []map[string]interface{}{},
		})
	}
}

func (ac *ApiController) GetThreads(c *gin.Context) {
	//domain := c.GetHeader("X-Vuedoo-Domain")
	//accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	//slug := c.Param("slug")
	//page := c.Param("page")

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"threads": []map[string]interface{}{},
	})
}

func (ac *ApiController) UpdateWorkspace(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")

	var request struct {
		Stripe_secret_key string `json:"stripe_secret_key"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request body",
		})
		return
	}

	fmt.Println("UpdateWorkspace - request:", request)

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":     "fail",
			"workspaces": nil,
		})
		return
	}

	userID := databaseManager.GetCurrentUser()

	if slug != "" {
		workspace, err := databaseManager.GetBlock(userID, "workspace", 0, slug, 0)
		if workspace != nil && err == nil {
			databaseManager.AddMeta("workspace", workspace["id"].(int64), "stripe_secret_key", request.Stripe_secret_key)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
	})
}

func (ac *ApiController) InitWorker(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	var content struct {
		ScannedId int64 `json:"user_id"`
	}

	if err := c.BindJSON(&content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail"})
		return
	}

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
		})
		return
	}

	workerName, _ := databaseManager.GetMeta("user", content.ScannedId, "name")
	workerPicture, _ := databaseManager.GetMeta("user", content.ScannedId, "picture")

	worker := map[string]interface{}{
		"id":     content.ScannedId,
		"name":   workerName,
		"email":  "", //email not shared
		"phone":  "", //phone not shared
		"avatar": workerPicture,
		"role":   "Worker", //default role
		"rating": 0.0,      //default rating
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"worker": worker,
	})
}

func (ac *ApiController) StartProject(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")

	var content struct {
		WorkerId    int64  `json:"user_id"`
		ProjectName string `json:"project_name"`
		ProjectId   int64  `json:"project_id"` //optional, for starting existing projects
	}

	if err := c.BindJSON(&content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail"})
		return
	}

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
		})
		return
	}

	userID := databaseManager.GetCurrentUser()

	if content.ProjectId < 1 {
		projectBlockData := map[string]interface{}{
			"type":    "project",
			"title":   content.ProjectName,
			"content": "",
			"parent":  0,
		}

		projectBlock, perr := databaseManager.AddBlock(userID, projectBlockData, "")

		if perr != nil {
			c.JSON(http.StatusOK, gin.H{
				"status": "fail",
				"block":  nil,
			})
			return
		} else {
			content.ProjectId = projectBlock["id"].(int64)
		}
	}

	recruitBlockData := map[string]interface{}{
		"type":    "recruit",
		"title":   content.ProjectName,
		"content": content.WorkerId,
		"parent":  content.ProjectId,
	}

	recruitBlock, rerr := databaseManager.AddBlock(userID, recruitBlockData, "")

	if rerr != nil && recruitBlock != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
			"block":  nil,
		})
		return
	}

	workerName, _ := databaseManager.GetMeta("user", content.WorkerId, "name")
	workerPicture, _ := databaseManager.GetMeta("user", content.WorkerId, "picture")

	worker := map[string]interface{}{
		"id":     content.WorkerId,
		"name":   workerName,
		"email":  "", //email not shared
		"phone":  "", //phone not shared
		"avatar": workerPicture,
		"role":   "Worker", //default role
		"rating": 0.0,      //default rating
	}

	// Note: Further implementation needed to actually start a project

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"worker": worker,
	})
}

func (ac *ApiController) GetActiveWorks(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")

	fmt.Println("GetActiveWorks called with domain:", domain, "accessKey:", accessKey)

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
			"works":  nil,
		})
		return
	}

	userID := databaseManager.GetCurrentUser()

	query := `
SELECT id, type, title, content, author, slug, parent, created_at, modified_at, status
FROM blocks
WHERE author = ? AND type = 'project' AND status = 1
ORDER BY created_at DESC
`
	args := []interface{}{
		userID,
	}

	rows, err := ac.db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
			"works":  nil,
		})
		return
	}
	defer rows.Close()

	var projects []map[string]interface{}
	for rows.Next() {
		var b services.Block
		err := rows.Scan(&b.ID, &b.Type, &b.Title, &b.Content, &b.Author, &b.Slug, &b.Parent, &b.CreatedAt, &b.ModifiedAt, &b.Status)
		if err != nil {
			log.Println(err)
			continue
		}

		// Fetch user metas for the project author
		metaQuery := `
SELECT meta_key, meta_value FROM metas 
WHERE parent = 'user' AND parent_id = ?
`
		metaRows, metaErr := ac.db.Query(metaQuery, b.Author)
		projectMetas := map[string]string{}
		if metaErr == nil {
			defer metaRows.Close()
			for metaRows.Next() {
				var metaKey, metaValue string
				if err := metaRows.Scan(&metaKey, &metaValue); err != nil {
					log.Println(err)
					continue
				}
				projectMetas[metaKey] = metaValue
			}
		}

		projects = append(projects, map[string]interface{}{
			"id":          int64(b.ID),
			"type":        b.Type,
			"title":       b.Title,
			"content":     b.Content,
			"author":      int64(b.Author),
			"slug":        b.Slug,
			"parent":      b.Parent,
			"created_at":  services.FormatTimeToISO(b.CreatedAt),
			"modified_at": services.FormatTimeToISO(b.ModifiedAt),
			"metas":       projectMetas,
			"status":      b.Status,
		})

	}

	rquery := `
SELECT id, type, title, content, author, slug, parent, created_at, modified_at, status
FROM blocks
WHERE content = ? AND type = 'recruit' AND status = 1
ORDER BY created_at DESC
`
	rargs := []interface{}{
		userID,
	}

	rrows, err := ac.db.Query(rquery, rargs...)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
			"works":  nil,
		})
		return
	}
	defer rows.Close()

	var recruits []map[string]interface{}
	for rrows.Next() {
		var b services.Block
		err := rrows.Scan(&b.ID, &b.Type, &b.Title, &b.Content, &b.Author, &b.Slug, &b.Parent, &b.CreatedAt, &b.ModifiedAt, &b.Status)
		if err != nil {
			log.Println(err)
			continue
		}

		// Fetch user metas for the project author
		metaQuery := `
SELECT meta_key, meta_value FROM metas 
WHERE parent = 'user' AND parent_id = ?
`
		metaRows, metaErr := ac.db.Query(metaQuery, b.Author)
		recruitMetas := map[string]string{}
		if metaErr == nil {
			defer metaRows.Close()
			for metaRows.Next() {
				var metaKey, metaValue string
				if err := metaRows.Scan(&metaKey, &metaValue); err != nil {
					log.Println(err)
					continue
				}
				recruitMetas[metaKey] = metaValue
			}
		}

		recruits = append(recruits, map[string]interface{}{
			"id":          int64(b.ID),
			"type":        b.Type,
			"title":       b.Title,
			"content":     b.Content,
			"author":      int64(b.Author),
			"slug":        b.Slug,
			"parent":      b.Parent,
			"created_at":  services.FormatTimeToISO(b.CreatedAt),
			"modified_at": services.FormatTimeToISO(b.ModifiedAt),
			"metas":       recruitMetas,
			"status":      b.Status,
		})
	}

	wquery := `
SELECT id, type, title, content, author, slug, parent, created_at, modified_at, status
FROM blocks
WHERE content = ? AND type = 'recruit' AND created_at > DATE(NOW()) AND status > 0
ORDER BY created_at DESC
`
	wargs := []interface{}{
		userID,
	}

	wrows, err := ac.db.Query(wquery, wargs...)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
			"works":  nil,
		})
		return
	}
	defer wrows.Close()

	var works []map[string]interface{}
	for wrows.Next() {
		var b services.Block
		err := wrows.Scan(&b.ID, &b.Type, &b.Title, &b.Content, &b.Author, &b.Slug, &b.Parent, &b.CreatedAt, &b.ModifiedAt, &b.Status)
		if err != nil {
			log.Println(err)
			continue
		}

		// Fetch user metas for the project author
		metaQuery := `
SELECT meta_key, meta_value FROM metas 
WHERE parent = 'user' AND parent_id = ?
`
		metaRows, metaErr := ac.db.Query(metaQuery, b.Author)
		recruitMetas := map[string]string{}
		if metaErr == nil {
			defer metaRows.Close()
			for metaRows.Next() {
				var metaKey, metaValue string
				if err := metaRows.Scan(&metaKey, &metaValue); err != nil {
					log.Println(err)
					continue
				}
				recruitMetas[metaKey] = metaValue
			}
		}

		works = append(works, map[string]interface{}{
			"id":          int64(b.ID),
			"type":        b.Type,
			"title":       b.Title,
			"content":     b.Content,
			"author":      int64(b.Author),
			"slug":        b.Slug,
			"parent":      b.Parent,
			"created_at":  services.FormatTimeToISO(b.CreatedAt),
			"modified_at": services.FormatTimeToISO(b.ModifiedAt),
			"metas":       recruitMetas,
			"status":      b.Status,
		})
	}

	// Note: getActiveWorks implementation needed
	//activeWorks := []map[string]interface{}{}

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"projects": projects,
		"recruits": recruits,
		"works":    works,
	})
}

func (ac *ApiController) GetProjects(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
			"works":  nil,
		})
		return
	}

	userID := databaseManager.GetCurrentUser()
	page := c.Param("page_no")
	pageNo, pErr := strconv.Atoi(page)
	if pErr != nil || pageNo < 1 {
		pageNo = 1
	}
	offset := (pageNo - 1) * 20

	query := `
SELECT id, type, title, content, author, slug, parent, created_at, modified_at, status
FROM blocks
WHERE author = ? AND type = 'project' AND status > 0
ORDER BY created_at DESC
LIMIT 20 OFFSET ?
`
	args := []interface{}{
		userID,
		offset,
	}

	rows, err := ac.db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
			"works":  nil,
		})
		return
	}
	defer rows.Close()

	var projects []map[string]interface{}
	for rows.Next() {
		var b services.Block
		err := rows.Scan(&b.ID, &b.Type, &b.Title, &b.Content, &b.Author, &b.Slug, &b.Parent, &b.CreatedAt, &b.ModifiedAt, &b.Status)
		if err != nil {
			log.Println(err)
			continue
		}

		// Fetch user metas for the project author
		metaQuery := `
SELECT meta_key, meta_value FROM metas 
WHERE parent = 'user' AND parent_id = ?
`
		metaRows, metaErr := ac.db.Query(metaQuery, b.Author)
		projectMetas := map[string]string{}
		if metaErr == nil {
			defer metaRows.Close()
			for metaRows.Next() {
				var metaKey, metaValue string
				if err := metaRows.Scan(&metaKey, &metaValue); err != nil {
					log.Println(err)
					continue
				}
				projectMetas[metaKey] = metaValue
			}
		}

		team := []map[string]interface{}{} // Note: team fetching implementation needed
		rquery := `
SELECT id, type, title, content, author, slug, parent, created_at, modified_at, status
FROM blocks
WHERE parent = ? AND type = 'recruit' AND status > 0
ORDER BY created_at DESC
`
		args := []interface{}{
			b.ID,
		}

		rrows, err := ac.db.Query(rquery, args...)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"status": "fail",
				"works":  nil,
			})
			return
		}
		defer rrows.Close()
		for rrows.Next() {
			var r services.Block
			err := rrows.Scan(&r.ID, &r.Type, &r.Title, &r.Content, &r.Author, &r.Slug, &r.Parent, &r.CreatedAt, &r.ModifiedAt, &r.Status)
			if err != nil {
				log.Println(err)
				continue
			}

			// Fetch user metas for the project author
			rmetaQuery := `
SELECT meta_key, meta_value FROM metas 
WHERE parent = 'user' AND parent_id = ?
`
			rmetaRows, rmetaErr := ac.db.Query(rmetaQuery, r.Content)
			recruitMetas := map[string]string{}
			if rmetaErr == nil {
				defer rmetaRows.Close()
				for rmetaRows.Next() {
					var metaKey, metaValue string
					if err := rmetaRows.Scan(&metaKey, &metaValue); err != nil {
						log.Println(err)
						continue
					}
					recruitMetas[metaKey] = metaValue
				}
			}

			team = append(team, map[string]interface{}{
				"id":          int64(r.ID),
				"type":        r.Type,
				"title":       r.Title,
				"content":     r.Content,
				"author":      int64(r.Author),
				"slug":        r.Slug,
				"parent":      r.Parent,
				"created_at":  services.FormatTimeToISO(r.CreatedAt),
				"modified_at": services.FormatTimeToISO(r.ModifiedAt),
				"metas":       recruitMetas,
				"status":      r.Status,
			})
		}

		projects = append(projects, map[string]interface{}{
			"id":          int64(b.ID),
			"type":        b.Type,
			"title":       b.Title,
			"content":     b.Content,
			"author":      int64(b.Author),
			"slug":        b.Slug,
			"parent":      b.Parent,
			"created_at":  services.FormatTimeToISO(b.CreatedAt),
			"modified_at": services.FormatTimeToISO(b.ModifiedAt),
			"metas":       projectMetas,
			"team":        team,
			"status":      b.Status,
		})

	}

	// Note: getActiveWorks implementation needed
	//activeWorks := []map[string]interface{}{}

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"projects": projects,
	})
}

func (ac *ApiController) GetWorkHistory(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")

	fmt.Println("GetActiveWorks called with domain:", domain, "accessKey:", accessKey)

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
			"works":  nil,
		})
		return
	}

	userID := databaseManager.GetCurrentUser()
	page := c.Param("page_no")
	pageNo, pErr := strconv.Atoi(page)
	if pErr != nil || pageNo < 1 {
		pageNo = 1
	}
	offset := (pageNo - 1) * 20

	wquery := `
SELECT id, type, title, content, author, slug, parent, created_at, modified_at, status
FROM blocks
WHERE content = ? AND type = 'recruit' AND status > 0
ORDER BY created_at DESC
LIMIT 20 OFFSET ?
`
	wargs := []interface{}{
		userID,
		offset,
	}

	wrows, err := ac.db.Query(wquery, wargs...)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
			"works":  nil,
		})
		return
	}
	defer wrows.Close()

	var works []map[string]interface{}
	for wrows.Next() {
		var b services.Block
		err := wrows.Scan(&b.ID, &b.Type, &b.Title, &b.Content, &b.Author, &b.Slug, &b.Parent, &b.CreatedAt, &b.ModifiedAt, &b.Status)
		if err != nil {
			log.Println(err)
			continue
		}

		// Fetch user metas for the project author
		metaQuery := `
SELECT meta_key, meta_value FROM metas 
WHERE parent = 'user' AND parent_id = ?
`
		metaRows, metaErr := ac.db.Query(metaQuery, b.Author)
		recruitMetas := map[string]string{}
		if metaErr == nil {
			defer metaRows.Close()
			for metaRows.Next() {
				var metaKey, metaValue string
				if err := metaRows.Scan(&metaKey, &metaValue); err != nil {
					log.Println(err)
					continue
				}
				recruitMetas[metaKey] = metaValue
			}
		}

		works = append(works, map[string]interface{}{
			"id":          int64(b.ID),
			"type":        b.Type,
			"title":       b.Title,
			"content":     b.Content,
			"author":      int64(b.Author),
			"slug":        b.Slug,
			"parent":      b.Parent,
			"created_at":  services.FormatTimeToISO(b.CreatedAt),
			"modified_at": services.FormatTimeToISO(b.ModifiedAt),
			"metas":       recruitMetas,
			"status":      b.Status,
		})
	}

	// Note: getActiveWorks implementation needed
	//activeWorks := []map[string]interface{}{}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"works":  works,
	})
}

func (ac *ApiController) TerminateMember(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")

	var content struct {
		WorkerId  int64 `json:"worker_id"`
		ProjectId int64 `json:"project_id"` //optional, for starting existing projects
	}

	if err := c.BindJSON(&content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail"})
		return
	}

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
		})
		return
	}

	userID := databaseManager.GetCurrentUser()
	utils := services.NewUtilities(ac.db)

	if content.ProjectId > 0 {
		utils.TerminateWorker(userID, content.WorkerId, content.ProjectId)
		databaseManager.AddMeta("recruit", content.WorkerId, "ended_at", time.Now().Format("2006-01-02 15:04:05"))
	}

	// Note: Implementation needed to terminate a member from a project
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
	})
}

func (ac *ApiController) TerminateProject(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")

	var content struct {
		ProjectId int64 `json:"project_id"` //optional, for starting existing projects
	}

	if err := c.BindJSON(&content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail"})
		return
	}

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
		})
		return
	}

	userID := databaseManager.GetCurrentUser()
	utils := services.NewUtilities(ac.db)

	if content.ProjectId > 0 {
		wblocks, _ := utils.TerminateWorkers(userID, content.ProjectId)
		for _, block := range wblocks {
			ended_at, _ := databaseManager.GetMeta("recruit", block.ID, "ended_at")
			if ended_at == "" {
				databaseManager.AddMeta("recruit", block.ID, "ended_at", time.Now().Format("2006-01-02 15:04:05"))
			}
		}

		utils.TerminateProject(userID, content.ProjectId)
		databaseManager.AddMeta("project", content.ProjectId, "ended_at", time.Now().Format("2006-01-02 15:04:05"))
	}

	// Note: Implementation needed to terminate a project
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
	})
}

func (ac *ApiController) LeaveProject(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")

	var content struct {
		WorkerId  int64 `json:"worker_id"`
		ProjectId int64 `json:"project_id"` //optional, for starting existing projects
	}

	if err := c.BindJSON(&content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail"})
		return
	}

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
		})
		return
	}

	userID := databaseManager.GetCurrentUser()
	utils := services.NewUtilities(ac.db)

	if content.ProjectId > 0 {
		utils.LeaveProject(userID, content.WorkerId, content.ProjectId)
		databaseManager.AddMeta("recruit", content.WorkerId, "ended_at", time.Now().Format("2006-01-02 15:04:05"))
	}

	// Note: Implementation needed to terminate a member from a project
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
	})
}

func (ac *ApiController) GetPendingPay(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")

	fmt.Println("GetActiveWorks called with domain:", domain, "accessKey:", accessKey)

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
			"works":  nil,
		})
		return
	}

	userID := databaseManager.GetCurrentUser()
	page := c.Param("page_no")
	pageNo, pErr := strconv.Atoi(page)
	if pErr != nil || pageNo < 1 {
		pageNo = 1
	}
	offset := (pageNo - 1) * 20

	wquery := `
SELECT id, type, title, content, author, slug, parent, created_at, modified_at, status
FROM blocks
WHERE author = ? AND type = 'recruit' AND status = 2
ORDER BY created_at DESC
LIMIT 20 OFFSET ?
`
	wargs := []interface{}{
		userID,
		offset,
	}

	wrows, err := ac.db.Query(wquery, wargs...)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
			"works":  nil,
		})
		return
	}
	defer wrows.Close()

	var recruits []map[string]interface{}
	for wrows.Next() {
		var b services.Block
		err := wrows.Scan(&b.ID, &b.Type, &b.Title, &b.Content, &b.Author, &b.Slug, &b.Parent, &b.CreatedAt, &b.ModifiedAt, &b.Status)
		if err != nil {
			log.Println(err)
			continue
		}

		// Fetch user metas for the project author
		metaQuery := `
SELECT meta_key, meta_value FROM metas 
WHERE parent = 'user' AND parent_id = ?
`
		metaRows, metaErr := ac.db.Query(metaQuery, b.Author)
		recruitMetas := map[string]string{}
		if metaErr == nil {
			defer metaRows.Close()
			for metaRows.Next() {
				var metaKey, metaValue string
				if err := metaRows.Scan(&metaKey, &metaValue); err != nil {
					log.Println(err)
					continue
				}
				recruitMetas[metaKey] = metaValue
			}
		}

		recruits = append(recruits, map[string]interface{}{
			"id":          int64(b.ID),
			"type":        b.Type,
			"title":       b.Title,
			"content":     b.Content,
			"author":      int64(b.Author),
			"slug":        b.Slug,
			"parent":      b.Parent,
			"created_at":  services.FormatTimeToISO(b.CreatedAt),
			"modified_at": services.FormatTimeToISO(b.ModifiedAt),
			"metas":       recruitMetas,
			"status":      b.Status,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"recruits": recruits,
	})
}

func (ac *ApiController) MarkPaid(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")

	var content struct {
		WorkerId string `json:"worker_id"`
	}

	fmt.Println("MarkPaid called with domain:", domain, "accessKey:", accessKey, "content:", content)

	if err := c.BindJSON(&content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail"})
		return
	}

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
		})
		return
	}

	userID := databaseManager.GetCurrentUser()
	utils := services.NewUtilities(ac.db)

	workerID, err := strconv.ParseInt(content.WorkerId, 10, 64)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
		})
	}

	if workerID > 0 {
		fmt.Println("MarkPaid called with WorkerId:", workerID, "UserID:", userID)
		utils.MarkRecruitsPaid(userID, workerID)
	}

	// Note: Implementation needed to mark a recruit as paid
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
	})
}

func (ac *ApiController) initGoogleAuth(c *gin.Context) {
	r := c.Request
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}

	redirect_url := scheme + "://" + r.Host + "/api/googleAuth/callback/"
	fmt.Println("Redirecting to Google OAuth with redirect URL:", redirect_url)

	http.Redirect(c.Writer, c.Request, "https://accounts.google.com/o/oauth2/v2/auth?client_id="+os.Getenv("GOOGLE_CLIENT_ID")+"&redirect_uri="+redirect_url+"&response_type=code&scope=email%20profile", http.StatusFound)
}

func (ac *ApiController) handleGoogleAuthCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail", "message": "Code not provided"})
		return
	}

	tokenResp, err := http.PostForm("https://oauth2.googleapis.com/token", url.Values{
		"code":          {code},
		"client_id":     {os.Getenv("GOOGLE_CLIENT_ID")},
		"client_secret": {os.Getenv("GOOGLE_CLIENT_SECRET")},
		"redirect_uri":  {"http://" + c.Request.Host + "/api/googleAuth/callback/"},
		"grant_type":    {"authorization_code"},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "message": "Failed to exchange code for token"})
		return
	}
	defer tokenResp.Body.Close()

	var tokenData struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(tokenResp.Body).Decode(&tokenData); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "message": "Failed to decode token response"})
		return
	}

	userInfoReq, _ := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	userInfoReq.Header.Set("Authorization", "Bearer "+tokenData.AccessToken)
	userInfoResp, err := http.DefaultClient.Do(userInfoReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "message": "Failed to fetch user info"})
		return
	}
	defer userInfoResp.Body.Close()

	var userInfo struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Email   string `json:"email"`
		Picture string `json:"picture"`
	}
	if err := json.NewDecoder(userInfoResp.Body).Decode(&userInfo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "message": "Failed to decode user info"})
		return
	}

	/*c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"user": map[string]interface{}{
			"id":     userInfo.ID,
			"name":   userInfo.Name,
			"email":  userInfo.Email,
			"avatar": userInfo.Picture,
		},
	})*/

	params := url.Values{}
	params.Add("status", "success")
	params.Add("id", userInfo.ID)
	params.Add("name", userInfo.Name)
	params.Add("email", userInfo.Email)
	params.Add("avatar", userInfo.Picture)

	deepLink := "coupdemain://auth/callback?" + params.Encode()
	fmt.Println("Redirecting to deep link:", deepLink)

	http.Redirect(c.Writer, c.Request, deepLink, http.StatusFound)
}

/*
func (ac *ApiController) AddNewThread(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")

	var saved bool
	if slug != "" {
		workspace := getWorkspace(ac.db, slug, domain, accessKey)
		if workspace != nil {
			var privileges []string
			if err := json.Unmarshal([]byte(workspace["meta_value"].(string)), &privileges); err == nil {
				if contains(privileges, "admin") {
					saved = addNewProfile(ac.db, workspace, c.Request)
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": map[bool]string{true: "success", false: "fail"}[saved],
	})
}

func (ac *ApiController) DeleteThread(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")

	var deleted bool
	if slug != "" {
		workspace := getWorkspace(ac.db, slug, domain, accessKey)
		if workspace != nil {
			var privileges []string
			if err := json.Unmarshal([]byte(workspace["meta_value"].(string)), &privileges); err == nil {
				if contains(privileges, "admin") {
					deleted = deleteProfile(ac.db, workspace, c.Request)
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": map[bool]string{true: "success", false: "fail"}[deleted],
	})
}

func (ac *ApiController) GetWorkspacesByPage(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	page := c.Param("page")

	pageNum, _ := strconv.Atoi(page)
	workspaces := getWorkspaces(ac.db, domain, accessKey, pageNum)
	subscription := getSubscriptionInfo(ac.db, domain, accessKey)

	c.JSON(http.StatusOK, gin.H{
		"status":       "success",
		"workspaces":   workspaces,
		"subscription": subscription,
	})
}

func (ac *ApiController) GetWorkspaceBySlug(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")

	workspace := getWorkspaceDetails(ac.db, slug, domain, accessKey)

	c.JSON(http.StatusOK, gin.H{
		"status":    map[bool]string{true: "success", false: "fail"}[workspace != nil],
		"workspace": workspace,
	})
}
*/

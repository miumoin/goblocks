package controllers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

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
		apiGroup.POST("/verify", ac.Verify)
		apiGroup.GET("/workspaces", ac.GetWorkspaces)
		apiGroup.GET("/workspaces/:page_no", ac.GetWorkspaces)
		apiGroup.POST("/workspaces/add", ac.AddNewWorkspace)
		apiGroup.POST("/workspace/delete", ac.DeleteWorkspace)
		apiGroup.GET("/workspace/:slug", ac.GetWorkspace)
		apiGroup.POST("/workspace/:slug/update", ac.UpdateWorkspace)
		apiGroup.GET("/workspace/:slug/threads/:page", ac.GetThreads)
		apiGroup.POST("/workspace/:slug/threads/add", ac.AddNewThread)
		apiGroup.GET("/workspace/:slug/thread/:threadSlug", ac.GetThread)
		apiGroup.POST("/workspace/:slug/thread/:threadSlug/update", ac.UpdateThread)
		apiGroup.POST("/workspace/:slug/thread/delete", ac.DeleteThread)
		apiGroup.POST("/workspace/:slug/thread/:threadSlug/execute", ac.ExecuteThread)
		apiGroup.GET("/agent/:slug/init", ac.InitAgent)
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
	userID, userEmail, newAccessKey, err := utils.MakeLogin(*databaseManager, c)
	if err == nil && userEmail != "" {
		fmt.Println("User logged in: ", userEmail)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     map[bool]string{true: "success", false: "fail"}[userID > 0],
		"access_key": newAccessKey,
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

	workspace, err := databaseManager.GetBlock(userID, "workspace", 0, slug, 0)
	if err != nil || workspace == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":    "fail",
			"workspace": nil,
			"threads":   nil,
		})
		return
	}

	pageNum, _ := strconv.Atoi(page)
	threads, err := databaseManager.GetBlocks(userID, "thread", pageNum, 20, 0)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":     "fail",
			"workspaces": nil,
		})
		return
	}

	fmt.Println("Threads:", threads)

	if threads == nil {
		threads = []map[string]interface{}{}
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "success",
		"workspace": workspace,
		"page":      page,
		"limit":     20,
		"threads":   threads,
	})
}

func (ac *ApiController) UpdateWorkspace(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")

	var request struct {
		Description string `json:"description"`
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
			databaseManager.AddMeta("workspace", workspace["id"].(int64), "description", request.Description)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
	})
}

func (ac *ApiController) AddNewThread(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")
	var content struct {
		Description string `json:"description"`
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
	var saved bool
	var block map[string]interface{}
	saved = false
	if slug != "" {
		workspace, err := databaseManager.GetBlock(userID, "workspace", 0, slug, 0)

		if workspace != nil && err == nil {
			//do nothing
		}

		if workspace != nil {
			fmt.Println("Workspace:", workspace["metas"])
			if metas, ok := workspace["metas"]; ok {
				privileges, ok := metas.(map[string]string)[fmt.Sprintf("privilege_%d", userID)]
				if !ok {
					return
				}

				var privArray []string
				json.Unmarshal([]byte(privileges), &privArray)

				contentJSON, err := json.Marshal(map[string]interface{}{
					"description": content.Description,
				})
				if err != nil {
					// handle error
				}

				if contains(privArray, "admin") {
					blockData := map[string]interface{}{
						"type":    "thread",
						"title":   content.Description[:min(35, len(content.Description))],
						"content": contentJSON,
						"parent":  workspace["id"].(int64),
					}

					block, err = databaseManager.AddBlock(userID, blockData, "")
					if err == nil && block != nil {
						saved = true
					}
				}
			}
		}
	}

	var outBlock interface{}
	if saved {
		outBlock = block
	} else {
		outBlock = nil
	}

	c.JSON(http.StatusOK, gin.H{
		"status": map[bool]string{true: "success", false: "fail"}[saved],
		"block":  outBlock,
	})
}

func (ac *ApiController) GetThread(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")
	threadSlug := c.Param("threadSlug")

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":     "fail",
			"workspaces": nil,
		})
		return
	}

	userID := databaseManager.GetCurrentUser()

	workspace, err := databaseManager.GetBlock(userID, "workspace", 0, slug, 0)
	if err != nil || workspace == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":    "fail",
			"workspace": nil,
			"thread":    nil,
		})
		return
	}

	thread, err := databaseManager.GetBlock(userID, "thread", 0, threadSlug, 0)
	if err != nil || thread == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":    "fail",
			"workspace": nil,
			"thread":    nil,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "success",
		"workspace": workspace,
		"thread":    thread,
	})
}

func (ac *ApiController) UpdateThread(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")
	threadSlug := c.Param("threadSlug")

	var content struct {
		Description string              `json:"description"`
		Endpoint    string              `json:"endpoint"`
		Type        string              `json:"type"`
		Headers     []map[string]string `json:"headers"`
		Body        []map[string]string `json:"body"`
	}

	if err := c.BindJSON(&content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail"})
		return
	}

	fmt.Println("Content:", content)

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
		})
		return
	}

	userID := databaseManager.GetCurrentUser()
	var saved bool
	var block map[string]interface{}
	saved = false
	if slug != "" {
		workspace, err := databaseManager.GetBlock(userID, "workspace", 0, slug, 0)

		if workspace != nil && err == nil {
			//do nothing
		}

		if workspace != nil {
			fmt.Println("Workspace:", workspace["metas"])
			if metas, ok := workspace["metas"]; ok {
				privileges, ok := metas.(map[string]string)[fmt.Sprintf("privilege_%d", userID)]
				if !ok {
					return
				}

				var privArray []string
				json.Unmarshal([]byte(privileges), &privArray)

				contentJSON, err := json.Marshal(map[string]interface{}{
					"description": content.Description,
					"endpoint":    content.Endpoint,
					"type":        content.Type,
					"headers":     content.Headers,
					"body":        content.Body,
				})
				if err != nil {
					// handle error
				}

				if contains(privArray, "admin") {
					blockData := map[string]interface{}{
						"type":    "thread",
						"title":   content.Description[:min(35, len(content.Description))],
						"content": contentJSON,
						"parent":  workspace["id"].(int64),
					}

					block, err = databaseManager.AddBlock(userID, blockData, threadSlug)
					if err == nil && block != nil {
						saved = true
					}
				}
			}
		}
	}

	var outBlock interface{}
	if saved {
		outBlock = block
	} else {
		outBlock = nil
	}

	c.JSON(http.StatusOK, gin.H{
		"status": map[bool]string{true: "success", false: "fail"}[saved],
		"block":  outBlock,
	})
}

func (ac *ApiController) DeleteThread(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")

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

	var deleted bool
	if slug != "" {
		workspace, err := databaseManager.GetBlock(userID, "workspace", 0, slug, 0)

		if workspace != nil && err == nil {
			//do nothing
		}

		if workspace != nil {
			fmt.Println("Workspace:", workspace["metas"])
			if metas, ok := workspace["metas"]; ok {
				privileges, ok := metas.(map[string]string)[fmt.Sprintf("privilege_%d", userID)]
				if !ok {
					return
				}

				var privArray []string
				json.Unmarshal([]byte(privileges), &privArray)

				if contains(privArray, "admin") {
					thread, err := databaseManager.GetBlock(userID, "thread", content.ID, "", workspace["id"].(int64))

					if thread != nil && err == nil {
						//do nothing
						err := databaseManager.DeleteBlock(content.ID)
						if err == nil {
							deleted = true
						} else {
							deleted = false
						}
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": map[bool]string{true: "success", false: "fail"}[deleted],
	})
}

func (ac *ApiController) ExecuteThread(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")
	threadSlug := c.Param("threadSlug")

	var content struct {
		Endpoint string              `json:"endpoint"`
		Type     string              `json:"type"`
		Headers  []map[string]string `json:"headers"`
		Body     []map[string]string `json:"body"`
	}

	if err := c.BindJSON(&content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail"})
		return
	}

	fmt.Println("ExecuteThread - Content:", content)

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":     "fail",
			"workspaces": nil,
		})
		return
	}

	userID := databaseManager.GetCurrentUser()
	workspace, err := databaseManager.GetBlock(userID, "workspace", 0, slug, 0)
	if err != nil || workspace == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":    "fail",
			"workspace": nil,
			"thread":    nil,
		})
		return
	}

	thread, err := databaseManager.GetBlock(userID, "thread", 0, threadSlug, 0)
	if err != nil || thread == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":    "fail",
			"workspace": nil,
			"thread":    nil,
		})
		return
	}

	utils := services.NewUtilities(ac.db)
	execData, _ := utils.ExecuteApi(content.Endpoint, content.Type, content.Headers, content.Body)

	// Implementation for executing a thread goes here
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   execData,
	})
}

func (ac *ApiController) InitAgent(c *gin.Context) {
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

	var workspaceID int64
	var userID int64
	err := ac.db.QueryRow("SELECT id, author FROM blocks WHERE slug = ?", slug).Scan(&workspaceID, &userID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":    "fail",
			"workspace": nil,
			"threads":   nil,
		})
		return
	}

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

/*
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

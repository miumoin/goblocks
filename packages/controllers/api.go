package controllers

import (
	"database/sql"
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
		apiGroup.GET("/workspace/:slug", ac.GetWorkspace)
		apiGroup.POST("/workspace/:slug/update", ac.UpdateWorkspace)
		apiGroup.GET("/workspace/:slug/threads/:page", ac.GetThreads)
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
	fmt.Println("AddNewWorkspace - block:", block, " err:", err)
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
			databaseManager.AddMeta("workspace", workspace["id"].(int64), "last_updated_by", userID)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
	})
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

	userID := getCurrentUser(ac.db, domain, accessKey)
	privileges := getMeta(ac.db, "workspace", content.ID, fmt.Sprintf("privilege_%d", userID))

	var deleted bool
	if privileges != nil {
		var privArray []string
		json.Unmarshal([]byte(privileges.(string)), &privArray)
		if contains(privArray, "admin") {
			deleted = deleteBlock(ac.db, content.ID)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": map[bool]string{true: "success", false: "fail"}[deleted],
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

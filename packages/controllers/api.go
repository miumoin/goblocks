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
		apiGroup.POST("/invoice/:slug/init", ac.InitiateInvoice)
		apiGroup.POST("/invoice/:slug/update", ac.UpdateInvoice)
		apiGroup.POST("/workspace/:slug/thread/delete", ac.DeleteThread)
		apiGroup.GET("/workspace/:slug/threads/:page", ac.GetThreads)
		apiGroup.GET("/workspace/:slug/profile/:profileSlug", ac.GetProfile)
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

	fmt.Println("Login - domain:", domain, " accessKey:", accessKey)

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

	if slug != "" {
		workspace, err := databaseManager.GetBlock(userID, "workspace", 0, slug, 0)
		//fmt.Println("GetThreads - domain:", domain, " accessKey:", accessKey, " slug:", slug, " page:", page)
		if workspace != nil && err == nil {
			threads, err := databaseManager.GetBlocks(userID, "invoice", 1, 20, workspace["id"].(int64))
			if err != nil || threads == nil {
				threads = []map[string]interface{}{}
			}

			//fmt.Println("GetThreads - threads:", threads)

			c.JSON(http.StatusOK, gin.H{
				"status":    "success",
				"workspace": workspace,
				"page":      page,
				"limit":     20,
				"threads":   threads,
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

func (ac *ApiController) InitiateInvoice(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")
	var request services.InvoiceRequest

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request body",
		})
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

	utils := services.NewUtilities(ac.db)
	profile, paymentLink, pErr := utils.CreateStripeInvoice(ac.db, domain, slug, *databaseManager, request)
	if pErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  "fail",
			"message": pErr.Error(),
		})
		return
	}

	fmt.Println("InitiateInvoice - domain:", domain, " accessKey:", accessKey, " slug:", slug)
	//fmt.Println("InitiateInvoice - request:", request)
	c.JSON(http.StatusOK, gin.H{
		"status":       "success",
		"payment_link": paymentLink,
		"profile":      profile,
	})
}

func (ac *ApiController) UpdateInvoice(c *gin.Context) {
	/*domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")

	var request struct {
		SessionId string `json:"session_id"`
		Status    string `json:"status"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request body",
		})
		return
	}

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":     "fail",
			"workspaces": nil,
		})
		return
	}*/

	//utils := services.NewUtilities(ac.db)
	//utils.UpdateInvoice(ac.db, domain, slug, *databaseManager, request)

	//fmt.Println("InitiateInvoice - request:", request)
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
	})
}

func (ac *ApiController) UpdateWorkspace(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")

	var request struct {
		Title             string `json:"title"`
		Stripe_secret_key string `json:"stripe_secret_key"`
		Stripe_currency   string `json:"stripe_currency"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid request body",
		})
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

	if slug != "" {
		workspace, err := databaseManager.GetBlock(userID, "workspace", 0, slug, 0)
		if workspace != nil && err == nil {
			databaseManager.AddBlock(workspace["author"].(int64), map[string]interface{}{
				"id":      workspace["id"].(int64),
				"type":    "workspace",
				"title":   request.Title,
				"content": workspace["content"].(string),
				"parent":  workspace["parent"].(int64),
			}, workspace["slug"].(string))

			databaseManager.AddMeta("workspace", workspace["id"].(int64), "stripe_secret_key", request.Stripe_secret_key)
			databaseManager.AddMeta("workspace", workspace["id"].(int64), "stripe_currency", request.Stripe_currency)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
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
	workspace, _ := databaseManager.GetBlock(userID, "workspace", 0, slug, 0)

	privileges := string("")
	privileges, Merr := databaseManager.GetMeta("workspace", workspace["id"].(int64), fmt.Sprintf("privilege_%d", userID))
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

func (ac *ApiController) GetProfile(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")
	profileSlug := c.Param("profileSlug")

	fmt.Println("GetProfile - domain:", domain, " accessKey:", accessKey, " slug:", slug, " profileSlug:", profileSlug)

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
		workspace, _ := databaseManager.GetBlock(userID, "workspace", 0, slug, 0)
		profile, err := databaseManager.GetBlock(userID, "invoice", 0, profileSlug, 0)
		if profile != nil && err == nil {
			c.JSON(http.StatusOK, gin.H{
				"status":    "success",
				"profile":   profile,
				"workspace": workspace,
			})
		}
	} else {
		c.JSON(http.StatusOK, gin.H{
			"status":    "fail",
			"profile":   map[string]interface{}{},
			"workspace": map[string]interface{}{},
		})
	}
}

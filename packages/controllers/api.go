package controllers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

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
		apiGroup.POST("/workspace/:slug/savePlot", ac.UpdateWorkspacePlot)
		apiGroup.POST("/workspace/:slug/saveCharacter", ac.SaveWorkspaceCharacter)
		apiGroup.POST("/workspace/:slug/deleteCharacter", ac.DeleteCharacter)
		apiGroup.POST("/workspace/:slug/generateTimeline", ac.GenerateTimeline)
		apiGroup.GET("/workspace/:slug/threads/:page", ac.GetThreads)
		apiGroup.GET("/workspace/:slug/thread/:threadSlug", ac.GetThread)
		apiGroup.POST("/workspace/:slug/thread/:threadSlug/update", ac.UpdateThread)
		apiGroup.POST("/workspace/:slug/thread/:threadSlug/execute", ac.ExecuteThread)
		apiGroup.GET("/agent/:slug/init", ac.InitAgent)
		apiGroup.POST("/agent/:slug/gettasks", ac.GetTasks)
		apiGroup.POST("/agent/:slug/prepare", ac.PrepareTask)
		apiGroup.POST("/agent/:slug/execute", ac.ExecuteTask)
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
			characters, err := databaseManager.GetBlocks(userID, "character", 1, 999999, workspace["id"].(int64))
			if err == nil && characters != nil {
				for _, character := range characters {
					// Parse the JSON string in the "content" field
					if contentStr, ok := character["content"].(string); ok && contentStr != "" {
						var parsedContent map[string]interface{}
						if err := json.Unmarshal([]byte(contentStr), &parsedContent); err == nil {
							// 1. Safely get the character ID
							charID, ok := character["id"].(int64)
							if !ok {
								continue // Skip if ID is missing or wrong type
							}

							// 2. Fetch the image metadata
							characterImage, _ := databaseManager.GetMeta("character", charID, "image")
							parsedContent["image"] = characterImage

							character["content"] = parsedContent
						}
					}
				}

				workspace["characters"] = characters
			}

			shots, err := databaseManager.GetBlocks(userID, "shot", 1, 999999, workspace["id"].(int64))
			if err == nil && shots != nil {
				for _, shot := range shots {
					// Parse the JSON string in the "content" field
					if contentStr, ok := shot["content"].(string); ok && contentStr != "" {
						var parsedContent map[string]interface{}
						if err := json.Unmarshal([]byte(contentStr), &parsedContent); err == nil {
							// 1. Safely get the character ID
							charID, ok := shot["id"].(int64)
							if !ok {
								continue // Skip if ID is missing or wrong type
							}

							// 2. Fetch the image metadata
							shotImage, _ := databaseManager.GetMeta("shot", charID, "image")
							parsedContent["image"] = shotImage

							shot["content"] = parsedContent
						}
					}
				}

				workspace["timelines"] = shots
			}

			c.JSON(http.StatusOK, gin.H{
				"status":    "success",
				"workspace": workspace,
				"page":      page,
				"limit":     20,
			})
		}
	} else {
		c.JSON(http.StatusOK, gin.H{
			"status":    "fail",
			"workspace": map[string]interface{}{},
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
		Title       string `json:"title"`
		Description string `json:"description"`
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
			blockData := map[string]interface{}{
				"type":    "workspace",
				"title":   request.Title,
				"content": "",
				"parent":  0,
			}

			workspace, err := databaseManager.AddBlock(userID, blockData, slug)

			if err != nil {
				c.JSON(http.StatusOK, gin.H{
					"status": "fail",
					"block":  nil,
				})
				return
			}

			databaseManager.AddMeta("workspace", workspace["id"].(int64), "description", request.Description)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
	})
}

func (ac *ApiController) UpdateWorkspacePlot(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")

	var request struct {
		PlotText string `json:"plotText"`
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
		fmt.Println("Workspace:", workspace)
		if workspace == nil && err != nil {
			c.JSON(http.StatusOK, gin.H{
				"status": "fail",
				"block":  nil,
			})
			return
		}
		databaseManager.AddMeta("workspace", workspace["id"].(int64), "plotText", request.PlotText)
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
	})
}

func (ac *ApiController) SaveWorkspaceCharacter(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")

	// 1. Define struct with 'form' tags to parse multipart/form-data
	var content struct {
		CharacterID int64  `form:"character_id"`
		Slug        string `form:"slug"`
		Name        string `form:"name" binding:"required"`
		Gender      string `form:"gender"`
		Height      string `form:"height"`
		BodyType    string `form:"bodyType"`
		Description string `form:"description"`
	}

	// 2. Bind the form data (works seamlessly for multipart/form-data)
	if err := c.ShouldBind(&content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail", "error": err.Error()})
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

		if err != nil {
			// Handle error
		}

		// 3. Create a map for the database 'metas' column (exclude CharacterID)
		characterMetas := map[string]interface{}{
			"name":        content.Name,
			"gender":      content.Gender,
			"height":      content.Height,
			"bodyType":    content.BodyType,
			"description": content.Description,
		}

		// 4. Marshal the map into a JSON-formatted byte slice
		metasJSON, err := json.Marshal(characterMetas)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "error": "Failed to encode metas"})
			return
		}

		blockData := map[string]interface{}{
			"type":    "character",
			"title":   content.Name[:min(35, len(content.Name))],
			"content": metasJSON,
			"parent":  workspace["id"].(int64),
		}

		block, err = databaseManager.AddBlock(userID, blockData, content.Slug)
		if err == nil && block != nil {
			saved = true
		}

		if saved != false {
			// 3. Handle Optional Image Upload
			var imageURL string
			if form, err := c.MultipartForm(); err == nil {
				if files, ok := form.File["image"]; ok && len(files) > 0 {
					fileHeader := files[0]
					file, err := fileHeader.Open()
					if err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "error": "failed to open file"})
						return
					}

					// 1. Extract the original file extension (e.g., ".jpg", ".png", ".webp")
					ext := filepath.Ext(fileHeader.Filename)

					// Generate unique S3 key
					fileSlug := databaseManager.NewSlug(15)
					s3Key := fmt.Sprintf("studio/%s/characters/%s%s", slug, fileSlug, ext)
					utils := services.NewUtilities(ac.db)

					// Upload to S3
					err = utils.UploadFileObjectToS3(c.Request.Context(), file, s3Key)

					// CRITICAL: Close the file immediately to prevent memory leaks!
					file.Close()

					if err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "error": "failed to upload to S3"})
						return
					}

					// TODO: Replace with your actual S3 bucket URL logic
					imageURL = fmt.Sprintf("https://"+os.Getenv("AWS_S3_BUCKET")+".s3.amazonaws.com/%s", s3Key)
					databaseManager.AddMeta("character", block["id"].(int64), "image", imageURL)
				}
			}

			// Add image URL to metas only if a new file was uploaded
			if imageURL != "" {
				characterMetas["image"] = imageURL
			}

			//get characters and let frontend know about them
			characters, err := databaseManager.GetBlocks(userID, "character", 1, 999999, workspace["id"].(int64))
			if err == nil && characters != nil {
				for _, character := range characters {
					// Parse the JSON string in the "content" field
					if contentStr, ok := character["content"].(string); ok && contentStr != "" {
						var parsedContent map[string]interface{}
						if err := json.Unmarshal([]byte(contentStr), &parsedContent); err == nil {
							// 1. Safely get the character ID
							charID, ok := character["id"].(int64)
							if !ok {
								continue // Skip if ID is missing or wrong type
							}

							// 2. Fetch the image metadata
							characterImage, _ := databaseManager.GetMeta("character", charID, "image")
							parsedContent["image"] = characterImage

							character["content"] = parsedContent
						}
					}
				}

				workspace["characters"] = characters
			}

			c.JSON(http.StatusOK, gin.H{
				"status":    "success",
				"workspace": workspace,
			})
		}
	} else {
		c.JSON(http.StatusOK, gin.H{
			"status": false,
		})
	}
}

func (ac *ApiController) GenerateTimeline(c *gin.Context) {
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

	// 1. Get the Workspace
	workspace, err := databaseManager.GetBlock(userID, "workspace", 0, slug, 0)
	if err != nil || workspace == nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "fail", "error": "workspace not found"})
		return
	}

	workspaceID, _ := workspace["id"].(int64)

	plot, _ := databaseManager.GetMeta("workspace", workspaceID, "plotText")

	if plot == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail", "error": "workspace has no plot/description"})
		return
	}

	characterContext := strings.Builder{}
	characters, err := databaseManager.GetBlocks(userID, "character", 1, 999999, workspace["id"].(int64))
	if err == nil && characters != nil {
		for _, character := range characters {
			// Parse the JSON string in the "content" field
			if contentStr, ok := character["content"].(string); ok && contentStr != "" {
				var parsedContent map[string]interface{}
				if err := json.Unmarshal([]byte(contentStr), &parsedContent); err == nil {
					// 1. Safely get the character ID
					charID, ok := character["id"].(int64)
					if !ok {
						continue // Skip if ID is missing or wrong type
					}

					// 2. Fetch the image metadata
					characterImage, _ := databaseManager.GetMeta("character", charID, "image")
					parsedContent["image"] = characterImage

					character["content"] = parsedContent
					characterContext.WriteString(fmt.Sprintf("Character: %s, Gender: %s, Height: %s, Body Type: %s, Description: %s, Image URL: %s\n", parsedContent["name"], parsedContent["gender"], parsedContent["height"], parsedContent["bodyType"], parsedContent["description"], characterImage))
				}
			}
		}

		workspace["characters"] = characters
	}

	// 4. Construct the Bedrock Prompt
	bedrockPrompt := fmt.Sprintf(`You are an expert film director, cinematographer, and AI video generation prompt engineer. 
Your task is to generate a detailed, shot-by-shot timeline (storyboard) for a film based on the provided plot and character references.

PLOT:
%s

CHARACTERS & REFERENCES:
%s

OUTPUT FORMAT:
Return ONLY a valid JSON array of objects. Do not include markdown formatting or explanatory text outside the JSON array. 
Each object represents a single shot and MUST contain the following exact keys:
- "shot_type": (String: e.g., "Wide", "Medium", "Close-up", "Over-the-shoulder")
- "movement": (String: e.g., "Static", "Pan", "Tilt", "Dolly", "Tracking")
- "duration": (String: e.g., "5s", "10s", "15s")
- "description": Elara looking out the window, reflection visible.
- "summary": Medium shot focusing on Elara\'s contemplative moment. Static camera with emphasis on the window reflection showing the city.,
- "master_shot": (Boolean: true if this is an establishing/master shot, false otherwise)

Ensure the timeline flows logically from beginning to end, creating a cohesive visual narrative.`, plot, characterContext.String())

	// 5. Process with AI Utility
	utils := services.NewUtilities(ac.db)

	//fmt.Println("Generated prompt:", bedrockPrompt)

	generatedTimeline, err := utils.GenerateBedrockText(bedrockPrompt, []map[string]string{})
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
			"error":  err.Error(),
		})
		return
	}

	fmt.Println("Bedrock response:", generatedTimeline)

	// 6. PARSE AND SAVE THE GENERATED TIMELINE

	// Step A: Clean the AI response (remove markdown ```json ... ``` wrappers)
	cleanJSON := strings.TrimSpace(generatedTimeline)
	startIdx := strings.Index(cleanJSON, "[")
	endIdx := strings.LastIndex(cleanJSON, "]")

	if startIdx == -1 || endIdx == -1 || endIdx <= startIdx {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "fail",
			"error":  "AI returned invalid JSON format",
			"raw":    generatedTimeline, // Return raw for debugging
		})
		return
	}

	// Extract just the JSON array part
	jsonArrayStr := cleanJSON[startIdx : endIdx+1]

	// Step B: Unmarshal into a Go slice
	var parsedShots []services.ShotData
	if err := json.Unmarshal([]byte(jsonArrayStr), &parsedShots); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "fail",
			"error":  fmt.Sprintf("Failed to parse generated shots: %v", err),
		})
		return
	}

	//fmt.Println("Parsed Shots:", parsedShots)

	//delete previous shots for this workspace
	err = databaseManager.DeleteBlocksByParent(userID, "shot", workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "fail",
			"error":  fmt.Sprintf("Failed to delete previous shots: %v", err),
		})
		return
	}

	// Step C: Loop through and save each shot as a block
	savedCount := 0
	for i, shot := range parsedShots {
		// Marshal the shot data back to a JSON string for the 'metas' column
		shotMetasBytes, err := json.Marshal(shot)
		if err != nil {
			continue // Skip if marshaling fails
		}

		//fmt.Println("Saving Shot:", shot.ShotType, "with metas:", string(shotMetasBytes))

		blockData := map[string]interface{}{
			"type":    "shot", // Change to "thread" if that's your schema
			"title":   fmt.Sprintf("Shot %d: %s", i+1, shot.ShotType),
			"content": string(shotMetasBytes),
			"parent":  workspaceID,
		}

		fmt.Println("Saving Shot Block:", blockData)

		_, err = databaseManager.AddBlock(userID, blockData, "")
		println("AddBlock error:", err)
		if err == nil {
			savedCount++
		}
	}

	// 6. (Optional) Save the generated timeline to the database as child blocks
	// Uncomment and adapt this block if you want to persist the shots immediately
	/*
		var timelineShots []map[string]interface{}
		if err := json.Unmarshal([]byte(generatedTimeline), &timelineShots); err == nil {
			for i, shotData := range timelineShots {
				shotMetas, _ := json.Marshal(shotData)
				blockData := map[string]interface{}{
					"type":    "shot",
					"title":   fmt.Sprintf("Shot %d", i+1),
					"metas":   string(shotMetas),
					"parent":  workspaceID,
				}
				databaseManager.AddBlock(userID, blockData, "")
			}
		}
	*/

	// 7. Return the generated timeline to the frontend
	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"timeline": generatedTimeline, // The frontend will parse this JSON string into an array
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

func (ac *ApiController) DeleteCharacter(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")

	var content struct {
		ID int64 `json:"character_id"`
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
					fmt.Println("Deleting character with ID:", content.ID)
					character, err := databaseManager.GetBlock(userID, "character", content.ID, "", workspace["id"].(int64))

					if character != nil && err == nil {
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

			//get characters and let frontend know about them
			characters, err := databaseManager.GetBlocks(userID, "character", 1, 999999, workspace["id"].(int64))
			if err == nil && characters != nil {
				for _, character := range characters {
					// Parse the JSON string in the "content" field
					if contentStr, ok := character["content"].(string); ok && contentStr != "" {
						var parsedContent map[string]interface{}
						if err := json.Unmarshal([]byte(contentStr), &parsedContent); err == nil {
							// 1. Safely get the character ID
							charID, ok := character["id"].(int64)
							if !ok {
								continue // Skip if ID is missing or wrong type
							}

							// 2. Fetch the image metadata
							characterImage, _ := databaseManager.GetMeta("character", charID, "image")
							parsedContent["image"] = characterImage

							character["content"] = parsedContent
						}
					}
				}

				workspace["characters"] = characters
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

func (ac *ApiController) GetTasks(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")

	var content struct {
		Message string `json:"message"`
	}

	if err := c.BindJSON(&content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail"})
		return
	}

	/*utils := services.NewUtilities(ac.db)
	response, err := utils.GenerateBedrockText("Hello from Bedrock!", []map[string]string{})
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
			"error":  err.Error(),
		})
		return
	}
	fmt.Println("Bedrock response:", response)*/

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
	userErr := ac.db.QueryRow("SELECT id, author FROM blocks WHERE slug = ?", slug).Scan(&workspaceID, &userID)
	if userErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":    "fail",
			"workspace": nil,
			"threads":   nil,
		})
		return
	} else {
		fmt.Println("Workspace ID:", workspaceID, "User ID:", userID)
	}

	if slug != "" {
		workspace, err := databaseManager.GetBlock(userID, "workspace", 0, slug, 0)
		if workspace != nil && err == nil {
			workspaceID = workspace["id"].(int64)

			threads, tErr := databaseManager.GetBlocks(userID, "thread", 1, 100, workspaceID)
			if tErr != nil {
				threads = []map[string]interface{}{}
			}
			//fmt.Println("Threads under workspace:", threads)

			var prompt string

			// Get all the threads under this workspace and prepare a prompt
			prompt = fmt.Sprintf("User commanded: %s\n\nHere are available APIs:\n", content.Message)

			for _, thread := range threads {
				if threadContent, ok := thread["content"]; ok {
					var threadData map[string]interface{}
					json.Unmarshal([]byte(threadContent.(string)), &threadData)
					if description, ok := threadData["description"].(string); ok {
						prompt += fmt.Sprintf("[%v]: %s\n", thread["id"], description)
					}
				}
			}

			prompt += "\nBased on the user command and available APIs, create a list of tasks to achieve the goal.\nRespond in JSON format of single dimensional array of API IDs in order: [id1, id2, ...]"

			fmt.Println("Generated prompt:", prompt)

			utils := services.NewUtilities(ac.db)
			response, err := utils.GenerateBedrockText(prompt, []map[string]string{})
			if err != nil {
				c.JSON(http.StatusOK, gin.H{
					"status": "fail",
					"error":  err.Error(),
				})
				return
			}
			fmt.Println("Bedrock response:", response)

			var apiIDs []int64
			// strip markdown code fences like ```json ... ``` or ``` ... ```
			cleanResp := strings.TrimSpace(response)
			if strings.HasPrefix(cleanResp, "```json") {
				cleanResp = strings.TrimPrefix(cleanResp, "```json")
			} else if strings.HasPrefix(cleanResp, "```") {
				cleanResp = strings.TrimPrefix(cleanResp, "```")
			}
			cleanResp = strings.TrimSuffix(cleanResp, "```")
			cleanResp = strings.TrimSpace(cleanResp)

			jsonErr := json.Unmarshal([]byte(cleanResp), &apiIDs)
			if jsonErr != nil {
				c.JSON(http.StatusOK, gin.H{
					"status": "fail",
					"error":  "Failed to parse Bedrock response",
				})
				return
			}

			var tasks []map[string]interface{}
			for _, apiID := range apiIDs {
				for _, thread := range threads {
					if thread["id"] == apiID {
						if threadContent, ok := thread["content"]; ok {
							var threadData map[string]interface{}
							json.Unmarshal([]byte(threadContent.(string)), &threadData)
							if desc, ok := threadData["description"]; ok {
								task := map[string]interface{}{
									"id":          apiID,
									"description": desc,
									"status":      0,
									"node": map[string]interface{}{
										"endpoint": threadData["endpoint"],
										"method":   threadData["type"],
										"headers":  threadData["headers"],
										"body":     threadData["body"],
									},
									"outputs": map[string]interface{}{},
								}
								tasks = append(tasks, task)
							}
						}
						break
					}
				}
			}

			fmt.Println("Built tasks:", tasks)

			//taskstring := "[{\"description\":\"Find the email address from a given name.\",\"id\":14,\"node\":{\"body\":[{\"key\":\"Name\",\"value\":\"{name of the person}\"},{\"key\":\"Company\",\"value\":\"{company he works at}\"}],\"endpoint\":\"https://api.example.com/find_email\",\"headers\":[{\"key\":\"Token\",\"value\":\"Bearer 123\"}],\"method\":\"POST\"},\"outputs\":{},\"status\":0},{\"description\":\"Create a meeting schedule on Calendly with a given time and date.\",\"id\":12,\"node\":{\"body\":[{\"key\":\"Name\",\"value\":\"{name of the person}\"},{\"key\":\"Email\",\"value\":\"{email of the person}\"},{\"key\":\"Date\",\"value\":\"{date of meeting}\"},{\"key\":\"Time\",\"value\":\"{time of meeting}\"}],\"endpoint\":\"https://api.calendly.com/users/me\",\"headers\":[{\"key\":\"Authorization\",\"value\":\"Bearer eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY2Y4ZGM1YmFmYThhNjVlNjg0MDIzZjdjMzJiZTgzNDliMjM4MDEzNWI0IiwidHlwIjoiUEFUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJodHRwczovL2F1dGguY2FsZW5kbHkuY29tIiwiaWF0IjoxNzY2ODYwOTM3LCJqdGkiOiJmNWUzNmRiMy0wNTE1LTQyZWMtOGMwZC01MWYyM2FmNjFkMDEiLCJ1c2VyX3V1aWQiOiI3OTNiZGQxYy01MDgyLTRlYzYtOGY3MS04NGI0NzQ3MDViZDcifQ.GAclkZpQg0jEjfKvW5cO1mXaFMjoD0pSUXZ3AZu3EzizfmUkBuTc13wiptpV-DsmzCsBU-ayGTLelyhazNgc3Q\"}],\"method\":\"POST\"},\"outputs\":{},\"status\":0},{\"description\":\"Send invited an email confirmation of a meeting schedule.\",\"id\":15,\"node\":{\"body\":[{\"key\":\"Email\",\"value\":\"{email of the user}\"},{\"key\":\"Text\",\"value\":\"Your meeting has been confirmed.\"}],\"endpoint\":\"https://api.example.com/send_confirm\",\"headers\":[{\"key\":\"Token\",\"value\":\"Bearer 123\"}],\"method\":\"POST\"},\"outputs\":{},\"status\":0}]"

			//var tasks []map[string]interface{}
			//json.Unmarshal([]byte(taskstring), &tasks)

			c.JSON(http.StatusOK, gin.H{
				"status":    "success",
				"workspace": workspace,
				"tasks":     tasks,
			})
		} else {
			c.JSON(http.StatusOK, gin.H{
				"status":    "fail",
				"workspace": map[string]interface{}{},
				"tasks":     []map[string]interface{}{},
			})
		}
	}
}

func (ac *ApiController) PrepareTask(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")
	fmt.Println("Ignored slug:", slug, "domain:", domain, "accessKey:", accessKey)

	var content struct {
		Prompt string `json:"prompt"`
	}

	if err := c.BindJSON(&content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail"})
		return
	}

	if content.Prompt != "" {
		utils := services.NewUtilities(ac.db)
		response, err := utils.GenerateBedrockText(content.Prompt, []map[string]string{})
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"status": "fail",
				"error":  err.Error(),
			})
			return
		}

		// strip markdown code fences like ```json ... ``` or ``` ... ```
		cleanResp := strings.TrimSpace(response)
		if strings.HasPrefix(cleanResp, "```json") {
			cleanResp = strings.TrimPrefix(cleanResp, "```json")
		} else if strings.HasPrefix(cleanResp, "```") {
			cleanResp = strings.TrimPrefix(cleanResp, "```")
		}
		cleanResp = strings.TrimSuffix(cleanResp, "```")
		cleanResp = strings.TrimSpace(cleanResp)

		var jsonResponse map[string]interface{}
		jsonErr := json.Unmarshal([]byte(cleanResp), &jsonResponse)
		if jsonErr != nil {
			c.JSON(http.StatusOK, gin.H{
				"status": "fail",
				"error":  "Failed to parse Bedrock response",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":   "success",
			"response": jsonResponse,
		})
		return
	} else {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
		})
	}
}

func (ac *ApiController) ExecuteTask(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")
	fmt.Println("Ignored slug:", slug, "domain:", domain, "accessKey:", accessKey)

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

	fmt.Println(content)

	utils := services.NewUtilities(ac.db)
	execData, _ := utils.ExecuteApi(content.Endpoint, content.Type, content.Headers, content.Body)

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"false_outputs": map[string]interface{}{
			"result":      "Task executed successfully",
			"Email":       "Ashik.Chowdhury@citybanik.com",
			"Meeting":     "2023-10-01T10:00:00Z",
			"MeetingLink": "https://calendly.com/ashik-chowdhury/meeting",
		},
		"outputs": execData,
	})
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

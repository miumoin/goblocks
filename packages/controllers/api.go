package controllers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
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
		apiGroup.POST("/devis/init", ac.InitDevis)
		apiGroup.GET("/devis/:slug", ac.GetDevis)
		apiGroup.POST("/devis/:slug/upload", ac.UploadPhotos)
		apiGroup.GET("/devisQueue/:page", ac.GetDevisRequests)
		apiGroup.POST("/generate/:slug", ac.GenerateQuote)
		apiGroup.POST("/dispatch/:slug", ac.DispatchQuote)
		apiGroup.GET("/partnerDevis/:slug", ac.GetPartnerDevis)
		apiGroup.POST("/submitDevis/:slug", ac.SubmitDevis)

		apiGroup.GET("/welcome", ac.ApiWelcome)
	}
}

func (ac *ApiController) InitDevis(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")

	var content struct {
		Email string `json:"email"`
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

	blockData := map[string]interface{}{
		"type":    "devis",
		"title":   content.Email,
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

	utils := services.NewUtilities(ac.db)
	subject := "Your Free Moving Quote: 2-minute photo upload"
	recipient := content.Email
	messagePlain := fmt.Sprintf("Hi,\n\nThank you for requesting a free moving quote.\n\nTo provide you with the most accurate estimate, we need to see the items you are moving. Please open the link below on your smartphone and snap a few quick photos:\n\n👉 https://wit.works/move/quote/%s/upload\n\nThis process takes less than 2 minutes and requires no app download. Once we receive your photos, our team will review them and send your personalized, no-obligation quote within [e.g., 24 hours].\n\nNote: If you did not request this quote, please simply disregard this email.\n\nBest regards,\nThe Wit Works Team\nwit.works\n[Your Contact Phone Number]", block["slug"])
	messageHTML := fmt.Sprintf("<p>Hi,</p><p>Thank you for requesting a free moving.</p><p>To provide you with the most accurate estimate, we need to see the items you are moving. Please open the link below on your smartphone and snap a few quick photos:</p><p>👉 <a href='https://wit.works/move/quote/%s/upload'>Upload Photos</a></p><p>This process takes less than 2 minutes and requires no app download. Once we receive your photos, our team will review them and send your personalized, no-obligation quote within [e.g., 24 hours].</p><p><strong>Note:</strong> If you did not request this quote, please simply disregard this email.</p><p>Best regards,<br>The Wit Works Team<br>wit.works<br>0767842690</p>", block["slug"])
	utils.SendEmail(recipient, subject, messagePlain, messageHTML)

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"block":  block,
	})
}

func (ac *ApiController) GetDevis(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil || slug == "" {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
		})
		return
	}

	userID := databaseManager.GetCurrentUser()

	devis, err := databaseManager.GetBlock(userID, "devis", 0, slug, 0)
	if devis != nil && err == nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "success",
			"devis":  devis,
		})
	} else {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
			"devis":  map[string]interface{}{},
		})
	}
}

func (ac *ApiController) GetPartnerDevis(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil || slug == "" {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
		})
		return
	}

	userID := databaseManager.GetCurrentUser()

	devis, err := databaseManager.GetBlock(userID, "devis", 0, slug, 0)
	devis["content"] = "Confidentielle"

	metasUpdated := map[string]interface{}{}

	// Handle both map[string]string and map[string]interface{}
	switch metas := devis["metas"].(type) {
	case map[string]string:
		for key, value := range metas {
			if key == "Address" {
				parts := strings.Split(value, ",")
				if len(parts) > 1 {
					value = strings.TrimSpace(parts[len(parts)-1])
				}
			}
			metasUpdated[key] = value
		}
	case map[string]interface{}:
		for key, value := range metas {
			if key == "Address" {
				if valueStr, ok := value.(string); ok {
					parts := strings.Split(valueStr, ",")
					if len(parts) > 1 {
						value = strings.TrimSpace(parts[len(parts)-1])
					}
				}
			}
			metasUpdated[key] = value
		}
	}

	devis["metas"] = metasUpdated

	fmt.Printf("GetPartnerDevis: Retrieved devis for slug '%s': %v, error: %v\n", slug, devis, err)

	if devis != nil && err == nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "success",
			"devis":  devis,
		})
	} else {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
			"devis":  map[string]interface{}{},
		})
	}
}

func (ac *ApiController) UploadPhotos(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")

	// Note: The json tags are ignored here because we use c.PostForm(),
	// but keeping the struct is fine for organizing the variables.
	var content struct {
		Address          string
		MoveDate         string
		IsFlexible       bool
		FlexibleDuration string
		Notes            string
		Slug             string
	}

	// 1. Parse the multipart form
	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail", "error": "invalid form data"})
		return
	}

	// 2. Read the text fields
	content.Address = c.PostForm("address")
	content.MoveDate = c.PostForm("moveDate")
	content.IsFlexible = c.PostForm("isFlexible") == "true"
	content.FlexibleDuration = c.PostForm("flexibleDuration")
	content.Notes = c.PostForm("notes")
	content.Slug = c.PostForm("slug")

	// 3. Fetch the photo objects
	files := form.File["photos[]"]
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail", "error": "no photos uploaded"})
		return
	}

	// 4. Initialize Database Manager
	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		// Return 500 for internal server errors, and include the error!
		c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "error": dErr.Error()})
		return
	}

	if slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail", "error": "missing slug parameter"})
		return
	}

	userID := databaseManager.GetCurrentUser()
	devis, err := databaseManager.GetBlock(userID, "devis", 0, slug, 0)

	// Properly handle the case where devis is not found
	if err != nil || devis == nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "fail", "error": "devis request not found"})
		return
	}

	// 5. SAFE TYPE ASSERTION (Prevents server panics)
	// Databases/JSON often return IDs as float64 or int instead of int64.
	var devisID int64
	if id, ok := devis["id"].(int64); ok {
		devisID = id
	} else if idFloat, ok := devis["id"].(float64); ok {
		devisID = int64(idFloat)
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "error": "invalid devis ID type in database"})
		return
	}

	// 6. UPLOAD FILES TO S3 (This was missing in your original code!)

	var uploadedS3Keys []string
	for _, fileHeader := range files {
		file, err := fileHeader.Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "error": "failed to open file"})
			return
		}

		// Generate unique S3 key
		s3Key := fmt.Sprintf("quotes/%s/%s", slug, fileHeader.Filename)

		utils := services.NewUtilities(ac.db)
		// Upload to S3 (Assuming you have the UploadFileObjectToS3 function from earlier)
		err = utils.UploadFileObjectToS3(c.Request.Context(), file, s3Key)

		// CRITICAL: Close the file immediately to prevent memory leaks!
		file.Close()

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "error": "s3 upload failed"})
			return
		}

		uploadedS3Keys = append(uploadedS3Keys, s3Key)
	}
	// For now, since the actual S3 upload code is commented out, we'll just return an empty array for uploadedS3Keys.
	//uploadedS3Keys := []string{} // Placeholder since the actual upload code is commented out
	photosJSON, err := json.Marshal(uploadedS3Keys)
	if err != nil {
		//return fmt.Errorf("failed to marshal uploaded S3 keys: %w", err)
	}

	// 7. Save Metadata to Database
	databaseManager.AddMeta("devis", devisID, "Address", content.Address)
	databaseManager.AddMeta("devis", devisID, "MoveDate", content.MoveDate)
	databaseManager.AddMeta("devis", devisID, "IsFlexible", content.IsFlexible)
	databaseManager.AddMeta("devis", devisID, "FlexibleDuration", content.FlexibleDuration)
	databaseManager.AddMeta("devis", devisID, "Notes", content.Notes)
	databaseManager.AddMeta("devis", devisID, "PhotosCount", len(files))
	databaseManager.AddMeta("devis", devisID, "Photos", string(photosJSON))

	databaseManager.AddBlock(userID, map[string]interface{}{
		"title":   devis["title"].(string),
		"content": devis["content"].(string),
		"status":  2, // Assuming 2 means "completed" or "photos uploaded"
	}, slug)

	// Optional: Save the actual S3 URLs/Keys so you can display them later
	// databaseManager.AddMeta("devis", devisID, "PhotoKeys", uploadedS3Keys)

	// 8. Success Response
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"devis":  devis,
		"photos": uploadedS3Keys, // Return the uploaded keys to the frontend
	})
}

func (ac *ApiController) GetDevisRequests(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	page := c.Param("page")
	pageNo, err := strconv.Atoi(page)
	if err != nil {
		pageNo = 1
	}

	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
		})
		return
	}

	userID := databaseManager.GetCurrentUser()

	devis, err := databaseManager.GetBlocks(userID, "devis", pageNo, 100, 0)
	if devis != nil && err == nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "success",
			"data":   devis,
		})
	} else {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
			"data":   map[string]interface{}{},
		})
	}
}

func (ac *ApiController) GenerateQuote(c *gin.Context) {
	// Implementation for generating quote
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")

	// 4. Initialize Database Manager
	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		// Return 500 for internal server errors, and include the error!
		c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "error": dErr.Error()})
		return
	}

	if slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail", "error": "missing slug parameter"})
		return
	}

	userID := databaseManager.GetCurrentUser()
	devis, err := databaseManager.GetBlock(userID, "devis", 0, slug, 0)

	// Properly handle the case where devis is not found
	if err != nil || devis == nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "fail", "error": "devis request not found"})
		return
	}

	// 5. SAFE TYPE ASSERTION (Prevents server panics)
	// Databases/JSON often return IDs as float64 or int instead of int64.
	var devisID int64
	if id, ok := devis["id"].(int64); ok {
		devisID = id
	} else if idFloat, ok := devis["id"].(float64); ok {
		devisID = int64(idFloat)
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "error": "invalid devis ID type in database"})
		return
	}

	// 1. Retrieve the metadata (assuming GetMeta returns []byte or string)
	photosData, err := databaseManager.GetMeta("devis", devisID, "Photos")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "fail",
			"error":  "failed to retrieve photos metadata",
		})
		return
	}

	var photoKeys []string

	// 2. Safely unmarshal only if data exists (prevents errors on empty/null DB fields)
	if len(photosData) > 0 {
		dataBytes := []byte(photosData)
		err = json.Unmarshal(dataBytes, &photoKeys)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status": "fail",
				"error":  "failed to parse photos JSON",
			})
			return
		}
	}

	// 3. Continue with your logic using the populated photoKeys slice
	// c.JSON(http.StatusOK, gin.H{"status": "success", "photos": photoKeys})

	fmt.Printf("Generating quote for devis ID %d with photos: %v\n", devisID, photoKeys)

	utils := services.NewUtilities(ac.db)

	// 2. Define the prompt for Bedrock
	prompt := "Act as a moving estimator.Analyze these photos of furnitures. Calculate the total volume in cubic meters and provide a list of probable packing materials. Do not over estimate, do not provide unnecessary items, be realistic & optimistic. Return only a JSON object with totalM3, estimatedMovePrice, and materials. I.e. {\"totalM3\": 12.5, \"estimatedMovePrice\": 1500, \"materials\": [{\"standard boxes\": 5}, {\"wardrobe boxes\": 3}, {\"bubble wrap\": 10}, {\"packing paper\": 20}, {\"tape\": 15}]}"

	// 3. Process and Analyze
	ctx := c.Request.Context()
	result, err := utils.ProcessAndAnalyzeImages(ctx, photoKeys, prompt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "error": err.Error()})
		return
	}

	fmt.Printf("Generated quote result: %s\n", result)
	quoteJSON, _ := utils.ExtractJSONFromResponse(result)

	databaseManager.AddMeta("devis", devisID, "Quote", quoteJSON)

	databaseManager.AddBlock(userID, map[string]interface{}{
		"title":   devis["title"].(string),
		"content": devis["content"].(string),
		"status":  3, // Assuming 3 means "quote generated"
	}, slug)

	var quote services.QuoteResponse
	if err := json.Unmarshal([]byte(quoteJSON), &quote); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "error": "failed to parse quote"})
		return
	}

	devisData := utils.ConvertQuoteToDevis(quote, fmt.Sprintf("WIT-%d", devisID))

	utils.SendDevisEmail(devis["title"].(string), devisData)

	c.JSON(http.StatusOK, gin.H{
		"status":    "success",
		"quoteJson": quote,
	})
}

func (ac *ApiController) DispatchQuote(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")

	var content struct {
		Emails []string `json:"emails"`
	}

	if err := c.BindJSON(&content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail", "error": "invalid JSON"})
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

	devis, err := databaseManager.GetBlock(userID, "devis", 0, slug, 0)
	if devis == nil || err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "fail", "error": "devis request not found"})
		return
	}

	fmt.Printf("Dispatching quote for devis ID %v to emails: %v\n", devis["id"], content.Emails)

	var devisID int64
	if id, ok := devis["id"].(int64); ok {
		devisID = id
	} else if idFloat, ok := devis["id"].(float64); ok {
		devisID = int64(idFloat)
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "error": "invalid devis ID type in database"})
		return
	}

	utils := services.NewUtilities(ac.db)

	quoteJSON, err := databaseManager.GetMeta("devis", devisID, "Quote")
	if err != nil || quoteJSON == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "error": "quote not found"})
		return
	}

	var quote services.QuoteResponse
	if err := json.Unmarshal([]byte(quoteJSON), &quote); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "error": "failed to parse quote"})
		return
	}

	devisData := utils.ConvertQuoteToDevis(quote, fmt.Sprintf("WIT-%d", devisID))

	for _, email := range content.Emails {
		if !contains(content.Emails, email) {
			continue
		}
		err := utils.SendDispatchEmail(email, devisData, fmt.Sprintf("https://wit.works/move/quote/%s", slug))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "error": fmt.Sprintf("failed to send email to %s: %v", email, err)})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
	})
}

func (ac *ApiController) SubmitDevis(c *gin.Context) {
	domain := c.GetHeader("X-Vuedoo-Domain")
	accessKey := c.GetHeader("X-Vuedoo-Access-Key")
	slug := c.Param("slug")

	// 1. Bind the incoming partner quote payload
	var content struct {
		CompanyName    string  `json:"companyName"`
		CompanySiret   string  `json:"companySiret"`
		CompanyEmail   string  `json:"companyEmail"`
		CompanyPhone   string  `json:"companyPhone"`
		TotalM3        float64 `json:"totalM3"`
		MovePrice      float64 `json:"movePrice"`
		MaterialsTotal float64 `json:"materialsTotal"`
		GrandTotal     float64 `json:"grandTotal"`
		Materials      []struct {
			ID        string  `json:"id"`
			Name      string  `json:"name"`
			Quantity  int     `json:"quantity"`
			UnitPrice float64 `json:"unitPrice"`
		} `json:"materials"`
	}

	if err := c.BindJSON(&content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail", "error": "invalid JSON payload"})
		return
	}

	// 2. Validate required fields
	if content.CompanyName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail", "error": "company name is required"})
		return
	}

	// Validate SIRET (14 digits)
	siretClean := strings.ReplaceAll(content.CompanySiret, " ", "")
	if len(siretClean) != 14 {
		c.JSON(http.StatusBadRequest, gin.H{"status": "fail", "error": "SIRET must be exactly 14 digits"})
		return
	}
	for _, ch := range siretClean {
		if ch < '0' || ch > '9' {
			c.JSON(http.StatusBadRequest, gin.H{"status": "fail", "error": "SIRET must contain only digits"})
			return
		}
	}

	// 3. Initialize database manager
	databaseManager, dErr := services.NewDatabaseManager(ac.db, domain, accessKey)
	if dErr != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"status": "fail",
			"error":  "failed to initialize database manager",
		})
		return
	}

	userID := databaseManager.GetCurrentUser()

	// 4. Fetch the original devis to get customer info
	devis, err := databaseManager.GetBlock(userID, "devis", 0, slug, 0)
	if devis == nil || err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "fail", "error": "devis request not found"})
		return
	}

	var devisID int64
	if id, ok := devis["id"].(int64); ok {
		devisID = id
	} else if idFloat, ok := devis["id"].(float64); ok {
		devisID = int64(idFloat)
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "error": "invalid devis ID type"})
		return
	}

	var customerEmail = devis["title"].(string) // Assuming the title contains the customer's email

	blockData := map[string]interface{}{
		"type":    "partnerDevis",
		"title":   content.CompanyEmail,
		"content": "",
		"parent":  devisID,
	}

	block, err := databaseManager.AddBlock(userID, blockData, "")

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status": "fail",
			"block":  nil,
		})
		return
	}

	var partnerDevisID int64
	if id, ok := block["id"].(int64); ok {
		partnerDevisID = id
	} else if idFloat, ok := block["id"].(float64); ok {
		partnerDevisID = int64(idFloat)
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "fail", "error": "invalid devis ID type in database"})
		return
	}

	databaseManager.AddMeta("partnerDevis", partnerDevisID, "CompanyName", content.CompanyName)
	databaseManager.AddMeta("partnerDevis", partnerDevisID, "CompanySiret", content.CompanySiret)
	databaseManager.AddMeta("partnerDevis", partnerDevisID, "CompanyPhone", content.CompanyPhone)
	databaseManager.AddMeta("partnerDevis", partnerDevisID, "CompanyEmail", content.CompanyEmail)
	databaseManager.AddMeta("partnerDevis", partnerDevisID, "TotalM3", content.TotalM3)
	databaseManager.AddMeta("partnerDevis", partnerDevisID, "MovePrice", content.MovePrice)
	databaseManager.AddMeta("partnerDevis", partnerDevisID, "MaterialsTotal", content.MaterialsTotal)
	databaseManager.AddMeta("partnerDevis", partnerDevisID, "GrandTotal", content.GrandTotal)
	materialsJSON, _ := json.Marshal(content.Materials)
	databaseManager.AddMeta("partnerDevis", partnerDevisID, "Materials", string(materialsJSON))

	fmt.Printf("Partner %s (SIRET: %s) submitting quote for devis ID %v to customer %s\n",
		content.CompanyName, siretClean, partnerDevisID, devis["title"])

	// 6. Build the quote data structure for PDF and email
	utils := services.NewUtilities(ac.db)

	// Convert materials to the expected format
	var materials []services.Material
	for i, m := range content.Materials {
		materials = append(materials, services.Material{
			ID:        i + 1,
			Name:      m.Name,
			Quantity:  m.Quantity,
			UnitPrice: m.UnitPrice,
		})
	}

	devisData := services.PartnerDevisData{
		Materials:      materials,
		TotalM3:        content.TotalM3,
		EstimatedPrice: content.GrandTotal,
		DevisNumber:    fmt.Sprintf("PARTNER-%s-%d", siretClean, partnerDevisID),
		Date:           time.Now(),
		// Partner-specific info for the PDF
		PartnerCompanyName: content.CompanyName,
		PartnerSiret:       siretClean,
		PartnerPhone:       content.CompanyPhone,
		PartnerEmail:       content.CompanyEmail,
		MaterialsTotal:     content.MaterialsTotal,
		MovePrice:          content.MovePrice,
	}

	// 8. Generate PDF of the partner's quote
	pdfBytes, err := utils.GeneratePartnerDevisPDF(devisData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "fail",
			"error":  fmt.Sprintf("failed to generate PDF: %v", err),
		})
		return
	}

	// 9. Send email to the customer with the partner's quote attached
	subject := fmt.Sprintf("New Offer from %s - Estimate N°%s",
		content.CompanyName, devisData.DevisNumber)

	messagePlain := fmt.Sprintf(`Hello,

A professional moving company has sent you an offer for your moving request.

Offer Details:
- Company: %s
- SIRET: %s
- Phone: %s
- Email: %s
- Volume: %.2f m³
- Total Price: €%.2f

You will find the detailed quote attached to this email.

Please feel free to contact the company directly for any questions.

Best regards,
The Wit Works Team
149 Avenue du Maine, Paris 75014`,
		content.CompanyName,
		siretClean,
		content.CompanyPhone,
		content.CompanyEmail,
		content.TotalM3,
		content.GrandTotal,
	)

	messageHTML := fmt.Sprintf(`
		<div style="font-family: Arial, sans-serif; color: #333;">
			<h2 style="color: #1e3c78;">Hello,</h2>
			<p>A professional moving company has sent you a <strong>new offer</strong> for your moving request.</p>
			
			<div style="background-color: #f0f5ff; padding: 15px; border-left: 4px solid #1e3c78; margin: 20px 0;">
				<h3 style="margin-top: 0; color: #1e3c78;">Offer Details</h3>
				<p><strong>Company:</strong> %s</p>
				<p><strong>SIRET:</strong> %s</p>
				<p><strong>Phone:</strong> <a href="tel:%s">%s</a></p>
				<p><strong>Email:</strong> <a href="mailto:%s">%s</a></p>
				<p><strong>Volume:</strong> %.2f m³</p>
				<p><strong>Total Price:</strong> <span style="color: #1e3c78; font-size: 18px; font-weight: bold;">€%.2f</span></p>
			</div>
			
			<p>You will find the detailed quote attached to this email.</p>
			<p>Please feel free to contact the company directly for any questions.</p>
			
			<p>Best regards,<br>
			<strong>The Wit Works Team</strong><br>
			149 Avenue du Maine, Paris 75014</p>
		</div>
	`,
		content.CompanyName,
		siretClean,
		content.CompanyPhone, content.CompanyPhone,
		content.CompanyEmail, content.CompanyEmail,
		content.TotalM3,
		content.GrandTotal,
	)

	pdfAttachment := services.EmailAttachment{
		Filename:    fmt.Sprintf("devis-%s-%s.pdf", content.CompanyName, devisData.DevisNumber),
		ContentType: "application/pdf",
		Content:     pdfBytes,
	}

	err = utils.SendEmailWithAttachments(
		customerEmail,
		subject,
		messagePlain,
		messageHTML,
		[]services.EmailAttachment{pdfAttachment},
		content.CompanyEmail,
		content.CompanyName,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "fail",
			"error":  fmt.Sprintf("failed to send quote to customer: %v", err),
		})
		return
	}

	// Only send if we have a partner email stored (you may want to add this to the payload)
	// For now, skip partner confirmation unless you add partnerEmail to the submission

	c.JSON(http.StatusOK, gin.H{
		"status":      "success",
		"devisNumber": devisData.DevisNumber,
		"message":     fmt.Sprintf("Quote successfully sent to %s", customerEmail),
	})
}

// GetInstallationURL handles the installation URL request
func (ac *ApiController) ApiWelcome(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"text":   "Welcome to the Shopify Quote Offer API!",
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

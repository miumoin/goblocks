package services

import (
	"bytes"
	"context"
	"crypto/md5"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"math"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sts"
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

// Utilities struct (like your PHP class)
type Utilities struct {
	db *sql.DB
}

// MistralResponse defines the structure of Mistral's response
type MistralResponse struct {
	Choices []struct {
		Index   int `json:"index"`
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
}

// For image content
type MistralImageContent struct {
	Type     string           `json:"type"`
	ImageURL *MistralImageURL `json:"image_url"`
}

type MistralImageURL struct {
	URL string `json:"url"`
}

// For text content
type MistralTextContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type ImageInput struct {
	Data      []byte
	MediaType string
}

// MistralPayload defines the correct JSON structure for Mistral on Bedrock
type MistralPayload struct {
	Messages    []MistralMessage `json:"messages"`
	MaxTokens   int              `json:"max_tokens,omitempty"`
	Temperature float64          `json:"temperature,omitempty"`
}

type MistralMessage struct {
	Role    string        `json:"role"`
	Content []interface{} `json:"content"` // Can be string or object
}

// ShotData represents the structure of the AI-generated shot
type ShotData struct {
	ShotType    string `json:"shot_type"`
	Movement    string `json:"movement"`
	Duration    string `json:"duration"`
	Description string `json:"description"`
	Summary     string `json:"summary"`
	MasterShot  bool   `json:"master_shot"`
}

const maxImageSizeBytes = 100 * 1024 // 100 KB

func (r *Request) GetContent() ([]byte, error) {
	return io.ReadAll(r.Body)
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

func (u *Utilities) ExecuteApi(Endpoint string, ApiType string, Headers []map[string]string, Body []map[string]string) (interface{}, error) {
	// Normalize method
	method := ApiType
	if method == "" {
		method = "GET"
	}

	// Build request body if needed
	var bodyBytes []byte
	if method != "GET" && len(Body) > 0 {
		fmt.Println("Body:", Body)
		bodyMap := map[string]interface{}{}
		for _, entry := range Body {
			for k, v := range entry {
				bodyMap[k] = v
			}
		}
		b, _ := json.Marshal(bodyMap)
		bodyBytes = b
	}

	// Create request
	var reqBody io.Reader
	if len(bodyBytes) > 0 {
		reqBody = bytes.NewBuffer(bodyBytes)
	}

	req, err := http.NewRequest(method, Endpoint, reqBody)
	if err != nil {
		return nil, err
	}

	fmt.Println("Headers:", Headers)
	// Attach headers from the thread content
	for _, h := range Headers {
		headerKey, ok1 := h["key"]
		headerValue, ok2 := h["value"]

		if ok1 && ok2 {
			req.Header.Set(headerKey, headerValue)
		}
	}

	// Ensure Content-Type when we have a body
	if len(bodyBytes) > 0 && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}

	// Execute the HTTP request
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Try to decode JSON response, fall back to status text if not JSON
	var respData interface{}
	if err := json.NewDecoder(resp.Body).Decode(&respData); err != nil {
		respData = map[string]interface{}{
			"status": resp.Status,
		}
	}

	return respData, nil
}

// write a function that makes an inference with a prompt
func (u *Utilities) GenerateBedrockText(prompt string, messages []map[string]string) (string, error) {
	ctx := context.Background()

	// Load AWS config
	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(os.Getenv("AWS_REGION")),
		config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(
				os.Getenv("AWS_ACCESS_KEY"),
				os.Getenv("AWS_SECRET_KEY"),
				"",
			),
		),
	)
	if err != nil {
		return "", err
	}

	client := bedrockruntime.NewFromConfig(cfg)

	// Append user prompt
	messages = append(messages, map[string]string{
		"role":    "user",
		"content": prompt,
	})

	// Create payload
	payload := map[string]interface{}{
		"messages": messages,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	// Invoke Bedrock model
	resp, err := client.InvokeModel(ctx, &bedrockruntime.InvokeModelInput{
		ModelId:     aws.String("mistral.mistral-large-2407-v1:0"),
		ContentType: aws.String("application/json"),
		Accept:      aws.String("application/json"),
		Body:        bodyBytes,
	})
	if err != nil {
		return "", err
	}

	// Parse response
	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	// resp.Body is a []byte from the SDK; wrap it with a reader for json.Decoder
	if err := json.NewDecoder(bytes.NewReader(resp.Body)).Decode(&result); err != nil {
		return "", err
	}

	if len(result.Choices) == 0 {
		return "No response generated.", nil
	}

	return result.Choices[0].Message.Content, nil
}

// UploadFileObjectToS3 uploads an io.Reader (file object) directly to S3
// and automatically detects and sets the correct Content-Type.
func (u *Utilities) UploadFileObjectToS3(ctx context.Context, fileReader io.Reader, objectKey string) error {
	// 1. Load AWS Configuration
	region := os.Getenv("AWS_REGION")
	accessKey := os.Getenv("AWS_ACCESS_KEY")
	secretKey := os.Getenv("AWS_SECRET_KEY")
	bucket := os.Getenv("AWS_S3_BUCKET")

	creds := credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")
	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(region),
		config.WithCredentialsProvider(creds),
	)
	if err != nil {
		return fmt.Errorf("failed to load AWS config: %w", err)
	}

	client := s3.NewFromConfig(cfg)

	stsClient := sts.NewFromConfig(cfg)
	_, err = stsClient.GetCallerIdentity(ctx, &sts.GetCallerIdentityInput{})
	if err != nil {
		fmt.Printf("❌ Credentials are INVALID or network is down: %v\n", err)
		return err
	}
	fmt.Println("✅ Credentials are VALID and network is connected!")

	// 2. Detect MIME Type
	// http.DetectContentType requires the first 512 bytes of the file.
	buf := make([]byte, 512)

	// Read up to 512 bytes. If the file is smaller, it returns io.ErrUnexpectedEOF, which is fine.
	n, err := io.ReadFull(fileReader, buf)
	if err != nil && err != io.ErrUnexpectedEOF && err != io.EOF {
		return fmt.Errorf("failed to read file header for MIME detection: %w", err)
	}

	// Trim the buffer to the actual bytes read
	buf = buf[:n]

	// Detect the content type (defaults to "application/octet-stream" if unknown)
	contentType := http.DetectContentType(buf)

	fmt.Printf("Detected MIME type: %s for object key: %s\n", contentType, objectKey)

	// 4. Upload using PutObject. Since manager is deprecated here, write the
	// stream to a temporary file, upload it, then remove the temp file.
	tmpFile, err := os.CreateTemp("/tmp", "upload-*-"+filepath.Base(objectKey))
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	tempPath := tmpFile.Name()

	// Ensure temp file is removed and closed
	defer func() {
		_ = tmpFile.Close()
		_ = os.Remove(tempPath)
	}()

	// Write the already-read header bytes, then the remainder of the stream
	if _, err := tmpFile.Write(buf); err != nil {
		return fmt.Errorf("failed to write header to temp file: %w", err)
	}
	if _, err := io.Copy(tmpFile, fileReader); err != nil {
		return fmt.Errorf("failed to write file to temp file: %w", err)
	}

	// Seek back to beginning for upload
	if _, err := tmpFile.Seek(0, io.SeekStart); err != nil {
		return fmt.Errorf("failed to seek temp file: %w", err)
	}

	// Get file info for ContentLength
	fi, err := tmpFile.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat temp file: %w", err)
	}

	fmt.Printf("Uploading file to S3: s3://%s/%s with Content-Type: %s and size: %d bytes\n", bucket, objectKey, contentType, fi.Size())

	_, err = client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(objectKey),
		Body:        tmpFile,
		ContentType: aws.String(contentType),
	})

	fmt.Printf("Upload result: %v\n", err)

	if err != nil {
		return fmt.Errorf("failed to upload object to S3: %w", err)
	}

	fmt.Printf("Successfully uploaded to s3://%s/%s as %s\n", bucket, objectKey, contentType)
	return nil
}

func (u *Utilities) ProcessAndAnalyzeImages(ctx context.Context, photoKeys []string, bedrockPrompt string) (string, error) {
	// 1. Load AWS Configuration
	region := os.Getenv("AWS_REGION")
	accessKey := os.Getenv("AWS_ACCESS_KEY")
	secretKey := os.Getenv("AWS_SECRET_KEY")
	bucket := os.Getenv("AWS_S3_BUCKET")

	creds := credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")
	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(region),
		config.WithCredentialsProvider(creds),
	)
	if err != nil {
		return "", fmt.Errorf("failed to load AWS config: %w", err)
	}

	s3Client := s3.NewFromConfig(cfg)

	var tempFilesToCleanup []string
	var imagesForBedrock []ImageInput

	// Helper to clean up all temp files when the function exits
	defer func() {
		for _, path := range tempFilesToCleanup {
			_ = os.Remove(path)
		}
	}()

	for _, key := range photoKeys {
		// 1. Download image from S3 to a temporary file
		tempPath, err := u.downloadS3ObjectToTemp(ctx, s3Client, bucket, key)
		if err != nil {
			return "", fmt.Errorf("failed to download %s: %w", key, err)
		}
		tempFilesToCleanup = append(tempFilesToCleanup, tempPath)

		// 2. Check file size and optimize if > 100KB
		fi, err := os.Stat(tempPath)
		if err != nil {
			return "", fmt.Errorf("failed to stat temp file %s: %w", tempPath, err)
		}

		if fi.Size() > maxImageSizeBytes {
			fmt.Printf("Image %s is %d bytes. Optimizing to under 100KB...\n", key, fi.Size())
			optimizedPath, err := u.optimizeImageToMaxSize(tempPath, maxImageSizeBytes)
			if err != nil {
				return "", fmt.Errorf("failed to optimize %s: %w", key, err)
			}
			// Replace the original temp path with the optimized one
			tempFilesToCleanup = append(tempFilesToCleanup, optimizedPath)
			tempPath = optimizedPath
		}

		// 3. Read the (possibly optimized) image into memory for Bedrock
		imageData, err := os.ReadFile(tempPath)
		if err != nil {
			return "", fmt.Errorf("failed to read optimized image %s: %w", tempPath, err)
		}

		// Determine media type (defaulting to jpeg since our optimizer outputs jpeg)
		mediaType := "image/jpeg"
		if filepath.Ext(key) == ".png" && fi.Size() <= maxImageSizeBytes {
			mediaType = "image/png"
		}

		imagesForBedrock = append(imagesForBedrock, ImageInput{
			Data:      imageData,
			MediaType: mediaType,
		})
	}

	// 4. Send all prepared images to Bedrock
	if len(imagesForBedrock) == 0 {
		return "", fmt.Errorf("no images were processed")
	}

	fmt.Printf("Sending %d images to Bedrock for analysis...\n", len(imagesForBedrock))

	// Mistral Large 3 Model ID
	modelID := "mistral.mistral-large-3-675b-instruct"

	// ⚠️ NOTE: If you get an "on-demand throughput isn't supported" error like you did with Claude,
	// you may need to prefix the model ID with "us." or "eu." (e.g. "us.mistral.mistral-large-3-675b-instruct")
	// depending on your region's cross-region inference requirements.

	result, err := u.QueryBedrockWithImages(ctx, bedrockPrompt, imagesForBedrock, modelID)
	if err != nil {
		return "", fmt.Errorf("bedrock analysis failed: %w", err)
	}

	return result, nil
}

// downloadS3ObjectToTemp fetches an object from S3 and saves it to a temporary file
func (u *Utilities) downloadS3ObjectToTemp(ctx context.Context, client *s3.Client, bucket, key string) (string, error) {
	resp, err := client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return "", fmt.Errorf("s3 get object failed: %w", err)
	}
	defer resp.Body.Close()

	// Create temp file with the original extension to help with format detection
	ext := filepath.Ext(key)
	if ext == "" {
		ext = ".jpg"
	}
	tmpFile, err := os.CreateTemp("", "s3-download-*"+ext)
	if err != nil {
		return "", fmt.Errorf("failed to create temp file: %w", err)
	}
	defer tmpFile.Close()

	if _, err := io.Copy(tmpFile, resp.Body); err != nil {
		os.Remove(tmpFile.Name()) // Clean up on failure
		return "", fmt.Errorf("failed to write to temp file: %w", err)
	}

	return tmpFile.Name(), nil
}

// optimizeImageToMaxSize decodes an image and re-encodes it as JPEG with decreasing
// quality until it falls under the maxSizeBytes limit.
func (u *Utilities) optimizeImageToMaxSize(inputPath string, maxSizeBytes int64) (string, error) {
	file, err := os.Open(inputPath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	// Decode the image (requires _ "image/jpeg" and _ "image/png" imports)
	img, _, err := image.Decode(file)
	if err != nil {
		return "", fmt.Errorf("failed to decode image: %w", err)
	}

	// Try progressively lower JPEG qualities until we hit the target size
	qualities := []int{85, 70, 50, 30, 15}

	for _, q := range qualities {
		tmpOut, err := os.CreateTemp("", "optimized-*.jpg")
		if err != nil {
			return "", err
		}

		// Encode as JPEG (this also converts PNGs to JPEG, which saves massive amounts of space)
		err = jpeg.Encode(tmpOut, img, &jpeg.Options{Quality: q})
		tmpOut.Close() // Must close before we can Stat or read it

		if err != nil {
			os.Remove(tmpOut.Name())
			continue
		}

		fi, err := tmpOut.Stat()
		if err != nil {
			os.Remove(tmpOut.Name())
			continue
		}

		if fi.Size() <= maxSizeBytes {
			return tmpOut.Name(), nil // Success! Under 100KB
		}

		// Not small enough, delete this attempt and try a lower quality
		os.Remove(tmpOut.Name())
	}

	// Fallback: If even quality 15 is too large (e.g., a massive 4K+ image),
	// we return an error. In a real app, you might want to add image resizing
	// here using a library like github.com/disintegration/imaging
	return "", fmt.Errorf("could not compress image under %d bytes even at lowest quality", maxSizeBytes)
}

// QueryBedrockWithImages sends a prompt and images to AWS Bedrock using Mistral Large 3
func (u *Utilities) QueryBedrockWithImages(ctx context.Context, prompt string, images []ImageInput, modelID string) (string, error) {
	// 1. Load AWS Configuration
	region := os.Getenv("AWS_REGION")
	accessKey := os.Getenv("AWS_ACCESS_KEY")
	secretKey := os.Getenv("AWS_SECRET_KEY")

	creds := credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")
	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(region),
		config.WithCredentialsProvider(creds),
	)
	if err != nil {
		return "", fmt.Errorf("failed to load AWS config: %w", err)
	}

	client := bedrockruntime.NewFromConfig(cfg)

	// 2. Build content array - Mistral expects an array of content objects
	var contentArray []interface{}

	// Add text prompt
	contentArray = append(contentArray, MistralTextContent{
		Type: "text",
		Text: prompt,
	})

	// Add images
	for _, img := range images {
		encodedImage := base64.StdEncoding.EncodeToString(img.Data)
		dataURI := fmt.Sprintf("data:%s;base64,%s", img.MediaType, encodedImage)

		contentArray = append(contentArray, MistralImageContent{
			Type: "image_url",
			ImageURL: &MistralImageURL{
				URL: dataURI,
			},
		})
	}

	// 3. Construct the payload
	payload := MistralPayload{
		Messages: []MistralMessage{
			{
				Role:    "user",
				Content: contentArray,
			},
		},
		MaxTokens:   2000,
		Temperature: 0.1,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Debug: Print the payload size (not the full payload as it's huge)
	fmt.Printf("Payload size: %d bytes\n", len(payloadBytes))

	// 4. Invoke the model
	output, err := client.InvokeModel(ctx, &bedrockruntime.InvokeModelInput{
		ModelId:     aws.String(modelID),
		ContentType: aws.String("application/json"),
		Body:        payloadBytes,
	})
	if err != nil {
		return "", fmt.Errorf("failed to invoke Bedrock model: %w", err)
	}

	// 5. Parse response
	var response MistralResponse
	if err := json.Unmarshal(output.Body, &response); err != nil {
		return "", fmt.Errorf("failed to unmarshal Bedrock response: %w", err)
	}

	if len(response.Choices) > 0 {
		return response.Choices[0].Message.Content, nil
	}

	return "", fmt.Errorf("no text content found in Bedrock response")
}

func (u *Utilities) ExtractJSONFromResponse(response string) (string, error) {
	// Try to find JSON within markdown code blocks
	jsonRegex := regexp.MustCompile("```json\\s*([\\s\\S]*?)\\s*```")
	matches := jsonRegex.FindStringSubmatch(response)

	var jsonStr string

	if len(matches) > 1 {
		// Found JSON in code block
		jsonStr = matches[1]
	} else {
		// Try to find raw JSON (in case there are no code blocks)
		jsonRegex = regexp.MustCompile(`\{[\s\S]*\}`)
		matches = jsonRegex.FindStringSubmatch(response)
		if len(matches) > 0 {
			jsonStr = matches[0]
		} else {
			return "", fmt.Errorf("no JSON found in response")
		}
	}

	// Clean up the JSON string
	jsonStr = strings.TrimSpace(jsonStr)

	// Validate and pretty-format the JSON
	var jsonData interface{}
	if err := json.Unmarshal([]byte(jsonStr), &jsonData); err != nil {
		return "", fmt.Errorf("invalid JSON extracted: %w", err)
	}

	// Return properly formatted JSON
	formattedJSON, err := json.MarshalIndent(jsonData, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to format JSON: %w", err)
	}

	return string(formattedJSON), nil
}

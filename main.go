package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"database/sql"

	_ "github.com/go-sql-driver/mysql"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/miumoin/agencybot/packages/controllers"
)

func main() {
	// Load .env file
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file (using system env vars instead)")
	}

	// Connect to MySQL database
	dsn := os.Getenv("DB_URL")
	var db *sql.DB
	var dberr error
	db, dberr = sql.Open("mysql", dsn)
	if dberr != nil {
		fmt.Println("Error connecting to database:", dberr)
		return
	}
	defer db.Close()

	// Setup router
	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()

	// Enable CORS for all origins
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Initialize services
	apiController := controllers.NewApiController(db, router)
	apiController.RegisterApiRoutes()
	apiController.RegisterHomeRoutes()

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// start the server (this is required!)
	log.Printf("Server running on port %s", port)
	routerErr := router.Run(":" + port) // or any port you prefer
	if routerErr != nil {
		log.Fatal(routerErr)
	}
}

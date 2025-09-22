// controllers/home.go
package controllers

import (
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

func (ac *ApiController) RegisterHomeRoutes() {
	// Get absolute path to your static files
	staticDir := "./view/dist/"

	// Serve static files from /static
	ac.router.Static("/static", filepath.Join(staticDir, "static"))

	// SPA Fallback: Serve index.html for all non-API routes
	ac.router.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path

		// If it's an API or webhook route, return JSON 404
		if strings.HasPrefix(path, "/api/") || strings.HasPrefix(path, "/webhooks/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "API route not found"})
			return
		}

		// Serve SPA entry point
		c.File(filepath.Join(staticDir, "/static/index.html"))
	})
}

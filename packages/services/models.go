package services

type InvoiceRequest struct {
	Title        string `json:"title"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	ShipAddress  string `json:"ship_address"`
	ShipPostcode string `json:"ship_postcode"`
	ShipCity     string `json:"ship_city"`
	ShipState    string `json:"ship_state"`
	ShipCountry  string `json:"ship_country"`
	Items        []Item `json:"items"`
}

type Item struct {
	Name  string  `json:"name"`
	Units int64   `json:"units"`
	Price float64 `json:"price"`
}

# Powder Coating APIs - Complete Documentation

## Base URL: `/api/powder-coating`
## Returns Base URL: `/api/powder-coating-returns`

---

## 🔵 Powder Coating Process APIs

### 1. Create Process
**URL:** `POST /api/powder-coating`

**Request:**
```json
{
  "customerId": 1,
  "status": "A",
  "items": [
    {
      "productId": 10,
      "quantity": 100,
      "totalBags": 5,
      "unitPrice": 25.50,
      "remarks": "Special coating required"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Process created successfully",
  "data": null
}
```

---

### 2. Update Process
**URL:** `PUT /api/powder-coating/{id}`

**Path Parameter:**
- `id` (Long) - Process ID

**Request:**
```json
{
  "customerId": 1,
  "status": "A",
  "items": [
    {
      "id": 5,
      "productId": 10,
      "quantity": 150,
      "totalBags": 7,
      "unitPrice": 25.50,
      "remarks": "Updated"
    },
    {
      "productId": 12,
      "quantity": 50,
      "totalBags": 3,
      "unitPrice": 28.00,
      "remarks": "New item"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Process updated successfully",
  "data": null
}
```

---

### 3. Delete Process
**URL:** `DELETE /api/powder-coating/{id}`

**Path Parameter:**
- `id` (Long) - Process ID

**Request:** None (Path parameter only)

**Response:**
```json
{
  "success": true,
  "message": "Process deleted successfully",
  "data": null
}
```

---

### 4. Search Processes
**URL:** `POST /api/powder-coating/search`

**Request:**
```json
{
  "search": "customer name",
  "customerId": 1,
  "status": "A",
  "currentPage": 0,
  "perPageRecord": 10,
  "sortBy": "id",
  "sortDir": "desc",
  "startDate": "01-01-2024 00:00:00",
  "endDate": "31-12-2024 23:59:59"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Processes retrieved successfully",
  "data": {
    "content": [
      {
        "id": 1,
        "customerId": 5,
        "customerName": "ABC Industries",
        "status": "A",
        "createdAt": "2024-01-15T10:30:00+05:30",
        "items": [
          {
            "id": 10,
            "productId": 20,
            "productName": "Aluminum Frame",
            "quantity": 100,
            "remainingQuantity": 80,
            "totalBags": 5,
            "unitPrice": 25.50,
            "totalAmount": 2550.00,
            "remarks": "Special coating"
          }
        ]
      }
    ],
    "totalElements": 45,
    "totalPages": 5
  }
}
```

---

### 5. Get Process
**URL:** `POST /api/powder-coating/getProcess`

**Request:**
```json
{
  "id": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Process retrieved successfully",
  "data": {
    "id": 1,
    "customerId": 5,
    "customerName": "ABC Industries",
    "status": "A",
    "createdAt": "2024-01-15T10:30:00+05:30",
    "items": [
      {
        "id": 10,
        "productId": 20,
        "productName": "Aluminum Frame",
        "quantity": 100,
        "remainingQuantity": 80,
        "totalBags": 5,
        "unitPrice": 25.50,
        "totalAmount": 2550.00,
        "remarks": "Special coating"
      }
    ]
  }
}
```

---

### 6. Return Quantity
**URL:** `POST /api/powder-coating/return`

**Request:**
```json
{
  "processItemId": 10,
  "returnQuantity": 20,
  "returnDate": "15-01-2024 14:30:00"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Quantity returned successfully",
  "data": null
}
```

---

### 7. Generate PDF
**URL:** `POST /api/powder-coating/generate-pdf`

**Request:**
```json
{
  "customerId": 5,
  "processIds": [1, 2, 3],
  "clientId": 1
}
```

**Response:**
- Content-Type: `application/pdf`
- Binary PDF file
- Filename: `estimate.pdf`

---

## 🟢 Powder Coating Return APIs

### 8. Search Returns
**URL:** `POST /api/powder-coating-returns/search`

**Request:**
```json
{
  "search": "customer or product name",
  "processId": 1,
  "processItemId": 10,
  "currentPage": 0,
  "perPageRecord": 10,
  "sortBy": "id",
  "sortDir": "desc"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Return history retrieved successfully",
  "data": {
    "content": [
      {
        "id": 100,
        "returnQuantity": 20,
        "createdAt": "2024-01-20T15:30:00+05:30",
        "processId": 1,
        "processItemId": 10,
        "totalQuantity": 100,
        "remainingQuantity": 80,
        "processIdFromItem": 1,
        "customerName": "ABC Industries",
        "productName": "Aluminum Frame"
      }
    ],
    "totalElements": 15,
    "totalPages": 2
  }
}
```

---

### 9. Delete Return
**URL:** `POST /api/powder-coating-returns/delete`

**Request:**
```json
{
  "id": 100
}
```

**Response:**
```json
{
  "success": true,
  "message": "Return record deleted successfully",
  "data": null
}
```

---

### 10. Update Return
**URL:** `POST /api/powder-coating-returns/update`

**Request:**
```json
{
  "id": 100,
  "returnQuantity": 25
}
```

**Response:**
```json
{
  "success": true,
  "message": "Return record updated successfully",
  "data": null
}
```

---

### 11. Get Returns by Process ID
**URL:** `POST /api/powder-coating-returns/getByProcessId`

**Request:**
```json
{
  "processId": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Return records retrieved successfully",
  "data": [
    {
      "id": 100,
      "returnQuantity": 20,
      "createdAt": "2024-01-20T15:30:00+05:30",
      "processId": 1,
      "processItemId": 10,
      "productName": "Aluminum Frame"
    }
  ]
}
```

---

### 12. Get Returns by Process Item ID
**URL:** `POST /api/powder-coating-returns/getByProcessItemId`

**Request:**
```json
{
  "processItemId": 10
}
```

**Response:**
```json
{
  "success": true,
  "message": "Return records retrieved successfully",
  "data": [
    {
      "id": 100,
      "returnQuantity": 20,
      "createdAt": "2024-01-20T15:30:00+05:30",
      "processId": 1,
      "processItemId": 10,
      "productName": "Aluminum Frame"
    }
  ]
}
```

---

## 📋 Summary Table

| # | Method | URL | Description |
|---|--------|-----|-------------|
| 1 | POST | `/api/powder-coating` | Create process |
| 2 | PUT | `/api/powder-coating/{id}` | Update process |
| 3 | DELETE | `/api/powder-coating/{id}` | Delete process |
| 4 | POST | `/api/powder-coating/search` | Search processes |
| 5 | POST | `/api/powder-coating/getProcess` | Get process details |
| 6 | POST | `/api/powder-coating/return` | Return quantity (item-level) |
| 7 | POST | `/api/powder-coating/generate-pdf` | Generate PDF |
| 8 | POST | `/api/powder-coating-returns/search` | Search returns |
| 9 | POST | `/api/powder-coating-returns/delete` | Delete return |
| 10 | POST | `/api/powder-coating-returns/update` | Update return |
| 11 | POST | `/api/powder-coating-returns/getByProcessId` | Get returns by process |
| 12 | POST | `/api/powder-coating-returns/getByProcessItemId` | Get returns by item |

---

## ⚠️ Important Notes

1. All endpoints require authentication token
2. All endpoints verify client authorization
3. Date format: `dd-MM-yyyy HH:mm:ss` (IST timezone)
4. `returnDate` in return API is optional (defaults to current time)
5. Process status becomes "C" only when ALL items have remainingQuantity = 0
6. Cannot delete process/item if returns exist


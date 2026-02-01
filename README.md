# CUET ConnectX - Backend API

<div align="center">
  
  **RESTful API for CUET ConnectX Platform**
  
  [![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js)](https://nodejs.org/)
  [![Express](https://img.shields.io/badge/Express-4.21.2-000000?logo=express)](https://expressjs.com/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb)](https://www.mongodb.com/atlas)
  [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
</div>

---

## 📖 About

This is the backend API server for CUET ConnectX - a platform connecting students and alumni of Chittagong University of Engineering and Technology (CUET).

### ✨ Features

- 🔐 **JWT Authentication** - Secure token-based authentication with expiry handling
- 🛡️ **Protected Routes** - Auth middleware for secure API endpoints
- 👤 **User Management** - Registration, login, profile management
- 🔒 **Password Hashing** - Secure bcrypt password encryption (select: false)
- 📊 **MongoDB Atlas** - Cloud database for scalable storage
- 🎓 **Smart Student ID Parsing** - Auto-extracts batch, department, and roll from 7-digit ID
- 👥 **Follow System** - Follow/unfollow with duplicate prevention
- 🛡️ **Owner-only Updates** - Users can only modify their own content
- 🌐 **CORS Enabled** - Multi-origin support for frontend integration

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [MongoDB Atlas](https://www.mongodb.com/atlas) account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/sayed-115/cuet-connectx-backend.git
   cd cuet-connectx-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your values:
   ```env
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   PORT=5000
   FRONTEND_URL=http://localhost:5173
   ```

4. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

---

## 📡 API Endpoints

> 🔒 = Requires JWT token in Authorization header

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Register new user |
| POST | `/api/auth/login` | ❌ | Login with email/studentId |
| GET | `/api/auth/me` | 🔒 | Get current user |

### Users
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users` | ❌ | Get all users (paginated) |
| GET | `/api/users/:id` | ❌ | Get user by ID |
| PUT | `/api/users/:id` | 🔒 | Update profile (self only) |
| POST | `/api/users/:id/follow` | 🔒 | Follow user |
| POST | `/api/users/:id/unfollow` | 🔒 | Unfollow user |

### Jobs
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/jobs` | ❌ | Get all jobs (paginated) |
| GET | `/api/jobs/:id` | ❌ | Get job by ID |
| POST | `/api/jobs` | 🔒 | Create job |
| PUT | `/api/jobs/:id` | 🔒 | Update job (owner only) |
| DELETE | `/api/jobs/:id` | 🔒 | Delete job (owner only) |

### Posts
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/posts` | ❌ | Get all posts (paginated) |
| POST | `/api/posts` | 🔒 | Create post |
| POST | `/api/posts/:id/like` | 🔒 | Like/unlike post |
| POST | `/api/posts/:id/comment` | 🔒 | Add comment |
| DELETE | `/api/posts/:id` | 🔒 | Delete post (author only) |

### Scholarships
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/scholarships` | ❌ | Get all scholarships |
| POST | `/api/scholarships` | 🔒 | Create scholarship |
| DELETE | `/api/scholarships/:id` | 🔒 | Delete (owner only) |

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | API health status |

---

## 🗂️ Project Structure

```
cuet-connectx-backend/
├── config/
│   └── db.js              # MongoDB connection
├── middleware/
│   └── auth.js            # JWT authentication middleware
├── models/
│   ├── User.js            # User schema with auto ID parsing
│   └── Job.js             # Job schema
├── routes/
│   ├── auth.js            # Authentication routes
│   ├── users.js           # User routes (with follow system)
│   ├── jobs.js            # Job routes (protected CRUD)
│   ├── scholarships.js    # Scholarship routes
│   └── posts.js           # Posts routes (with like/comment)
├── server.js              # Express app entry point
├── .env.example           # Environment template
├── PRODUCTION_CHECKLIST.md # Deployment guide
└── package.json
```

---

## 🔧 Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB Atlas with Mongoose ODM
- **Authentication:** JWT (jsonwebtoken)
- **Password Hashing:** bcryptjs
- **Environment:** dotenv

---

## 📜 License

This project is licensed under the MIT License.

---

## 👨‍💻 Author

**Md Abu Sayed**
- GitHub: [@sayed-115](https://github.com/sayed-115)

---

<div align="center">
  Made with ❤️ for CUETians
</div>

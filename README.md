# CUET ConnectX — Backend API

<div align="center">

**REST API for the CUET ConnectX platform**

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb)](https://www.mongodb.com/atlas)
[![Render](https://img.shields.io/badge/Deployed_on-Render-46E3B7?logo=render)](https://render.com/)

</div>

---

## Architecture

```
Frontend (Vercel)  →  Backend API (Render)  →  MongoDB Atlas
                                            →  Cloudinary (images)
                                            →  SendGrid (transactional emails)
```

---

## Authentication Flow

| Flow | Route | Method |
|------|-------|--------|
| Register | `/api/auth/register` | POST |
| Login | `/api/auth/login` | POST |
| Get current user | `/api/auth/me` | GET |
| Verify email | `/api/auth/verify-email?token=` | GET |
| Resend verification | `/api/auth/resend-verification` | POST |
| Forgot password | `/api/auth/forgot-password` | POST |
| Reset password | `/api/auth/reset-password` | POST |
| Change password | `/api/users/change-password` | PUT |

### How it works

1. **Signup** → User created with `emailVerified: false` → SHA-256 hashed verification token stored → email sent via SendGrid → user clicks link → `emailVerified: true`
2. **Login** → Blocked if `emailVerified: false` (403) → JWT issued on success (7-day expiry)
3. **Forgot password** → Accepts email or studentId → SHA-256 hashed token stored → reset email sent → 10-minute expiry
4. **Reset password** → Token verified → password updated → `passwordChangedAt` set → old JWTs invalidated
5. **Change password** → Current password verified → new password set → `passwordChangedAt` set
6. **Session invalidation** → Auth middleware compares `JWT iat` vs `passwordChangedAt` → rejects stale tokens

---

## API Routes

| Route | Description |
|-------|-------------|
| `/api/auth/*` | Authentication (register, login, verify, reset) |
| `/api/users/*` | User profiles, follow/unfollow, change password |
| `/api/jobs/*` | Job listings CRUD |
| `/api/scholarships/*` | Scholarship listings CRUD |
| `/api/posts/*` | Community posts CRUD |
| `/api/admin/*` | Admin panel (user management, content moderation) |
| `/api/health` | Health check |

---

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB Atlas cluster (or local MongoDB)
- [SendGrid](https://sendgrid.com/) account with API key and verified sender email
- [Cloudinary](https://cloudinary.com/) account (image hosting)

### Installation

```bash
git clone https://github.com/sayed-115/cuet-connectx-backend.git
cd cuet-connectx-backend
npm install
```

### Environment Variables

Create a `.env` file (see `.env.example`):

```env
# Server
PORT=5000
NODE_ENV=production

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/cuet-connectx
# Optional alias used by some hosting providers:
# DATABASE_URL=mongodb+srv://<user>:<pass>@cluster.mongodb.net/cuet-connectx

# JWT
JWT_SECRET=your_jwt_secret_here

# Cloudinary
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>

# Email (SendGrid HTTP API)
EMAIL_USER=your-verified-sender@yourdomain.com
SENDGRID_API_KEY=your-sendgrid-api-key

# URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000
CORS_ORIGIN=http://localhost:5173
```

### Run locally

```bash
node server.js
```

Server starts at `http://localhost:5000`.

### Seed data

```bash
node seed.js            # Seed jobs, scholarships, posts
npm run seed-admin      # Create admin user
```

---

## Deployment (Render)

1. Push to GitHub
2. Create a **Web Service** on [Render](https://render.com)
3. Settings:
   - **Root Directory**: (leave empty)
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. Add all environment variables from `.env.example`
5. Set `CORS_ORIGIN` to your Vercel frontend URL
6. Set `FRONTEND_URL` to your Vercel frontend URL (used in email links)

> **Note:** Email is sent via SendGrid (`@sendgrid/mail`). `EMAIL_USER` must be a verified sender identity/domain in SendGrid, and `SENDGRID_API_KEY` must be a valid API key with Mail Send permissions.

---

## Project Structure

```
├── server.js              # Express app entry point
├── config/
│   └── cloudinary.js      # Cloudinary configuration
├── controllers/
│   ├── adminController.js # Admin operations
│   └── profileController.js
├── middleware/
│   ├── auth.js            # JWT auth + session invalidation
│   ├── authorizeAdmin.js  # Admin role check
│   ├── upload.js          # Cloudinary multer middleware
│   └── validate.js        # Input validation
├── models/
│   ├── User.js            # User schema (auth, profile, verification)
│   ├── Job.js             # Job listing schema
│   ├── Scholarship.js     # Scholarship schema
│   └── Post.js            # Community post schema
├── routes/
│   ├── auth.js            # Auth routes (register, login, verify, reset)
│   ├── users.js           # User CRUD, follow, change password
│   ├── jobs.js            # Job CRUD
│   ├── scholarships.js    # Scholarship CRUD
│   ├── posts.js           # Post CRUD
│   └── adminRoutes.js     # Admin panel routes
├── utils/
│   ├── email.js           # SendGrid email service
│   └── cloudinary.js      # Cloudinary helpers
├── seed/                  # Database seeders
├── scripts/               # Admin scripts
└── .env.example           # Environment template
```

---

## License

MIT

# CUET ConnectX - Production Deployment Checklist

## ✅ Security Hardening (COMPLETED)

### Backend
- [x] JWT authentication middleware with expiry detection
- [x] Protected routes require valid token (POST/PUT/DELETE)
- [x] Owner-only updates (users can only edit their own profile/posts/jobs)
- [x] Self-follow prevention
- [x] Duplicate follow prevention using `$addToSet`
- [x] Input sanitization (string trimming, length limits)
- [x] Whitelist allowed update fields (batch/dept cannot be modified via API)
- [x] CORS configuration with multiple origins support
- [x] `x-powered-by` header disabled
- [x] Request body size limits (10MB)
- [x] Password hashing with bcrypt (salt rounds: 12)

### Frontend
- [x] Auto-logout on 401 responses
- [x] Token expiry detection
- [x] Custom `ApiError` class with status codes
- [x] Event-based logout notification to AuthContext

---

## 🚀 Pre-Deployment Tasks

### Environment Variables
1. **Backend** - Create `.env` from `.env.example`:
   ```bash
   cp .env.example .env
   ```
   - Set `NODE_ENV=production`
   - Use strong `JWT_SECRET` (32+ characters)
   - Set `CORS_ORIGIN` to production frontend URL
   - Set `MONGODB_URI` to production database

2. **Frontend** - Create `.env` from `.env.example`:
   ```bash
   cp .env.example .env
   ```
   - Set `VITE_API_URL` to production backend URL

### MongoDB Atlas
- [ ] Create production database with separate credentials
- [ ] Enable IP whitelist or allow from anywhere (0.0.0.0/0) for cloud hosting
- [ ] Enable database user authentication
- [ ] Consider enabling backup/restore

### Deployment Options

#### Backend (Node.js)
- **Render.com** (Free tier available)
- **Heroku**
- **DigitalOcean App Platform**

#### Frontend (React/Vite)
- **Vercel** (Recommended for React)
- **Netlify**
- **Cloudflare Pages**

---

## 📋 API Endpoints Summary

### Auth (`/api/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /register | ❌ | Register new user |
| POST | /login | ❌ | Login with studentId/email |
| GET | /me | ✅ | Get current user |

### Users (`/api/users`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | / | ❌ | List all users (paginated) |
| GET | /:id | ❌ | Get user by ID |
| PUT | /:id | ✅ | Update profile (self only) |
| POST | /:id/follow | ✅ | Follow user |
| POST | /:id/unfollow | ✅ | Unfollow user |

### Jobs (`/api/jobs`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | / | ❌ | List all jobs (paginated) |
| GET | /:id | ❌ | Get job by ID |
| POST | / | ✅ | Create job |
| PUT | /:id | ✅ | Update job (owner only) |
| DELETE | /:id | ✅ | Delete job (owner only) |
| POST | /:id/apply | ✅ | Apply to job |

### Posts (`/api/posts`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | / | ❌ | List all posts (paginated) |
| GET | /:id | ❌ | Get post by ID |
| POST | / | ✅ | Create post |
| PUT | /:id | ✅ | Update post (author only) |
| DELETE | /:id | ✅ | Delete post (author only) |
| POST | /:id/like | ✅ | Like/unlike post |
| POST | /:id/comment | ✅ | Add comment |
| DELETE | /:id/comment/:commentId | ✅ | Delete comment |

### Scholarships (`/api/scholarships`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | / | ❌ | List all scholarships |
| GET | /:id | ❌ | Get scholarship by ID |
| POST | / | ✅ | Create scholarship |
| PUT | /:id | ✅ | Update scholarship (owner only) |
| DELETE | /:id | ✅ | Delete scholarship (owner only) |

---

## 🔒 Security Notes

1. **JWT Token**: Expires after 7 days. Frontend auto-logs out on expiry.
2. **Password**: Never returned in API responses.
3. **User Updates**: Cannot modify `studentId`, `batch`, `department` after registration.
4. **CORS**: Only whitelisted origins can make requests.

---

## 📦 Final Steps

```bash
# Backend - Install dependencies and start
cd cuet-connectx-backend
npm install
npm start

# Frontend - Build for production
cd cuet-connectx-frontend
npm install
npm run build
# Deploy the 'dist' folder
```

---

## ✅ Ready to Ship!

This project is now production-ready with:
- Secure authentication flow
- Protected API endpoints
- Input validation and sanitization
- Proper error handling
- Auto-logout on session expiry
- Environment-based configuration

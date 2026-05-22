# AGENTS.md

## Project Context
- This is a MERN Equipment Rental Hub project.
- Backend is inside `Server`.
- Frontend is inside `Client`.
- Do not rewrite unrelated features.
- Make small focused changes only.
- Preserve existing folder structure and coding style.
- Do not remove existing business logic unless it is clearly broken.
- Always inspect related routes, controllers, services, models, validation, and frontend usage before changing code.
- Never commit `.env`, secrets, `node_modules`, `dist`, logs, or build artifacts.
- After each change, run relevant tests/build/lint where possible.
- Explain changed files and why they were changed.

## Deployment Safety Rules
- Do not expose MongoDB, JWT, Google OAuth, Razorpay, Cloudinary, email, or other secrets.
- Example env files must contain placeholders only.
- Frontend production code must not depend on localhost.
- Backend production cookie/CORS must support split frontend/backend deployment.
- MongoDB production deployment should use MongoDB Atlas or replica set if transactions are used.

## Deployment Readiness Checklist
- [ ] Secrets are not hardcoded in code or example env files.
- [ ] `.env` files are untracked and excluded from commits.
- [ ] Frontend API base URL is environment-driven for production.
- [ ] No production fallback points to `localhost`.
- [ ] Cookie settings and CORS are verified for cross-domain auth.
- [ ] MongoDB deployment mode supports transactions (Atlas/replica set) if required.
- [ ] Payment/OAuth/Cloudinary/email config is validated via env variables only.
- [ ] Relevant tests/build/lint commands run successfully for touched areas.
- [ ] Only intended files are changed.

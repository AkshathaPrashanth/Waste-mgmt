# Track — Smart City Waste Management

EcoTrack is a community waste-reporting dashboard with an overview, live report heatmap, admin tools, and an optional ML microservice.

## Run on Windows

1. Install Node.js 18 or newer.
2. Double-click `start.bat`, or start the API and UI in separate terminals:

   ```powershell
   cd backend
   npm install
   npm start
   ```

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

3. Open <http://localhost:5173>.

The API listens on port 5000 and the Vite development server proxies `/api` requests to it. Reports are available from the bundled demo data when Firebase is not configured. To connect Firebase, provide a valid service account file and configure the Realtime Database URL in `backend/firebase.js`; do not commit service credentials.

## Admin demo access

- Email: `admin@ecotrack.com`
- Password: `admin@123`

Admin access allows status updates and municipality alerts. Set `JWT_SECRET` in `backend/.env` to a private random value before using the application outside a local demo.

## Optional ML service

The backend runs without Python. To enable the risk and hotspot service, install Python 3.10+ and run:

```powershell
cd ml-service
python -m pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

The backend includes local risk scoring and hotspot clustering when this service is stopped. Running it adds the FastAPI risk, black-spot grouping, recommendation, and `/health` endpoints.

Binny answers common questions about reports, photos, votes, statuses, risk, the heatmap, admin access, and waste sorting locally. These answers do not require a Gemini key; Gemini is only used for other questions when `GEMINI_API_KEY` is configured.

## Main project paths

- `frontend/` — React + Vite dashboard, live heatmap, admin portal, and report form
- `backend/` — Express API, authentication, report data, and optional Firebase integration
- `ml-service/` — optional FastAPI risk and hotspot analysis

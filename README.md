# ZNHM-AAU Museum Ticketing App

ZNHM-AAU is a bilingual (English/Amharic) mobile ticketing app for the
Zoological Natural History Museum at Addis Ababa University. Visitors can
discover the museum, select ticket categories, choose an available visit date,
pay online, and manage their tickets from one place.

The repository contains the Expo mobile app and the Django API that supports
visitor authentication, booking, payments, receipts, refunds, and gate-side
booking updates.

## Visitor app flow

1. **Explore the museum** — The home screen introduces the museum, explains
   the visit, shows hours and location, and provides quick access to booking.
   The feature cards can be swiped manually or rotate automatically.
2. **Sign in securely** — Visitors sign in without a password using their
   email, phone number, and a one-time verification code. New visitors may
   provide their name during sign-in.
3. **Confirm email** — Visitors whose email is not yet verified can request a
   new verification email and check their status before booking.
4. **Choose tickets** — Visitors select one or more ticket categories and
   quantities. Prices and category names are shown in the selected language.
5. **Choose a date** — The booking calendar shows available dates and prevents
   selection of dates that are closed for booking.
6. **Review and pay** — The visitor reviews the ticket mix, date, quantity, and
   total before creating the booking. Payment is completed through Chapa.
   Payment status is confirmed by the server rather than trusting only the
   browser redirect.
7. **Manage bookings** — The My Bookings tab lists the visitor's bookings.
   Booking details include the ticket reference, visit information, status,
   payment link when needed, and the receipt.
8. **Use the ticket** — Confirmed visitors can present their ticket reference
   and QR/ticket information at the museum entrance.
9. **Update or cancel** — Eligible bookings can be edited before payment,
   cancelled, or rescheduled once. Visitors can also request an eligible
   partial refund when the recorded attendance is lower than the booked
   quantity.
10. **Manage the account** — The Profile tab supports English/Amharic
    language selection, account details, and sign-out.

## Main features

- English and Amharic localization
- Passwordless visitor authentication with OTP verification
- Secure token storage on Android and iOS
- Individual and group visit booking flows
- Ticket category and availability lookup
- Chapa payment checkout and server-side payment verification
- Booking history and detailed digital tickets
- Receipt viewing and device download/share support
- Cancellation, one-time rescheduling, and refund requests
- Visitor profile and language preferences
- Responsive Expo web support for development and browser use

## Project structure

```text
frontend/       Expo Router mobile app for visitors
backend/        Django + Django REST Framework API
contracts/      Shared OpenAPI contract
docs/           Product, requirements, design, API, and QA documentation
docker-compose.yml
```

The ignored `frontend_web/` directory is not part of the mobile app delivery.

## Technology

- **Mobile app:** Expo, React Native, Expo Router, TypeScript
- **Data fetching:** TanStack Query
- **API:** Django, Django REST Framework, PostgreSQL
- **Authentication:** JWT access tokens with an HTTP-only refresh cookie;
  native access tokens use Expo SecureStore
- **Background processing:** Celery and Redis
- **Payments:** Chapa
- **Generated documents:** Django storage with PDF receipt generation

## Local setup

### 1. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Set a strong `SECRET_KEY` and provide the local database, Redis, and Chapa
settings required by your environment.

### 2. Configure the mobile app

```bash
cp frontend/.env.example frontend/.env
```

Set `EXPO_PUBLIC_API_URL` to an API URL reachable by the runtime:

```env
EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
```

For a physical phone, replace `localhost` with the computer's LAN IP address.
For remote device testing, use a reachable HTTPS tunnel or deployment URL.

### 3. Start the backend stack

From the repository root:

```bash
docker compose up --build
```

Apply migrations in another terminal:

```bash
docker compose exec api python manage.py migrate
docker compose exec api python manage.py createsuperuser
```

The API is available at `http://localhost:8000`. When enabled, the API schema
and Swagger UI are available at:

- `http://localhost:8000/api/schema/`
- `http://localhost:8000/api/schema/swagger-ui/`

### 4. Start the Expo app

```bash
cd frontend
npm install
npx expo start
```

Expo can launch the app in Expo Go, an Android emulator, an iOS simulator, or
the browser. Use the runtime-specific API URL described above.

## Development commands

From `frontend/`:

```bash
npx tsc --noEmit
npm run lint
```

Backend tests and management commands should be run through the backend
environment or Docker Compose. See [backend/README.md](backend/README.md) for
backend-specific development details.

## API contract and documentation

The shared API contract is
[contracts/openapi.yaml](contracts/openapi.yaml). The broader product and
engineering documentation is in [docs/](docs/), including:

- [Product overview](docs/01-product-overview.md)
- [Software requirements](docs/02-software-requirements-specification.md)
- [Software design](docs/03-software-design-specification.md)
- [Testing and quality assurance](docs/07-testing-and-quality-assurance.md)
- [Deployment and DevOps](docs/08-deployment-and-devops.md)

When backend serializers, views, or URLs change, regenerate the contract and
then regenerate the frontend API types so both sides remain aligned.

# Deployment Guide: AWS ECR/EC2

## Prerequisites

- AWS CLI configured with appropriate credentials
- ECR repository created: `weather-service`
- EC2 instance with access to Systems Manager Parameter Store
- IAM role attached to EC2 instance with SSM permissions

## Setup Instructions

### 1. Store API Key in AWS Systems Manager Parameter Store

```bash
# Store WEATHER_API_KEY as a SecureString parameter
aws ssm put-parameter \
  --name /weather-service/WEATHER_API_KEY \
  --value "your-weather-api-key-here" \
  --type SecureString \
  --region us-east-1
```

### 2. IAM Policy for EC2 Instance

Attach this policy to your EC2 instance IAM role to allow reading from Parameter Store:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter"
      ],
      "Resource": "arn:aws:ssm:us-east-1:ACCOUNT-ID:parameter/weather-service/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt"
      ],
      "Resource": "arn:aws:kms:us-east-1:ACCOUNT-ID:key/KEY-ID"
    }
  ]
}
```

### 3. Build and Push to ECR

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com

# Build Docker image
docker build -t weather-service:latest .

# Tag for ECR
docker tag weather-service:latest ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com/weather-service:latest

# Push to ECR
docker push ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com/weather-service:latest
```

### 4. Run on EC2

#### Option A: Using Docker directly

```bash
# Pull and run the image
docker run -d \
  --name weather-service \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e AWS_REGION=us-east-1 \
  ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com/weather-service:latest
```

#### Option B: Using ECS (Recommended)

Create an ECS task definition with:
- Image: `ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com/weather-service:latest`
- Environment variables:
  - `NODE_ENV=production`
  - `AWS_REGION=us-east-1`
  - `WEATHER_API_KEY_PARAM=/weather-service/WEATHER_API_KEY` (optional, uses default)

### 5. Local Development

For local development, use your `.env` file:

```env
NODE_ENV=development
WEATHER_API_KEY=your-api-key-here
PORT=3000
```

Run with:
```bash
npm install
npm run dev
```

## Configuration Details

### Environment Variables

- `NODE_ENV`: Set to `production` on EC2, `development` locally
- `AWS_REGION`: AWS region for Systems Manager (default: `us-east-1`)
- `WEATHER_API_KEY_PARAM`: Parameter Store path (default: `/weather-service/WEATHER_API_KEY`)
- `PORT`: Server port (default: `3000`)
### Network Binding

The server automatically binds to different network interfaces based on environment:
- **Development** (`NODE_ENV=development`): Binds to `localhost` (127.0.0.1) - only accessible from local machine
- **Production** (`NODE_ENV=production`): Binds to `0.0.0.0` - accessible from all network interfaces (required for containers)
### How It Works

1. **Local Development**: `NODE_ENV` is not set or `development`
   - Config loads from `.env` file via `dotenv`
   - `WEATHER_API_KEY` is read from `.env`
   - Server binds to `localhost` for security

2. **Production (EC2)**: `NODE_ENV=production`
   - Config loads from AWS Systems Manager Parameter Store
   - EC2 IAM role provides authenticated access
   - Parameter is retrieved as SecureString and decrypted
   - Server binds to `0.0.0.0` to accept external connections

### Rate Limiting

The `/weather/current` endpoint is protected with rate limiting:
- **Limit**: 10 requests per minute per IP address
- **Response**: HTTP 429 when limit exceeded
- **Purpose**: Prevents API abuse and protects backend resources

## Troubleshooting

### "Failed to retrieve WEATHER_API_KEY from AWS Systems Manager"

- Verify IAM role has SSM permissions
- Check parameter name matches: `/weather-service/WEATHER_API_KEY`
- Verify KMS key permissions if using SecureString
- Check AWS region is correct

### "WEATHER_API_KEY is not set in .env file"

- Ensure `.env` file exists in project root
- Verify `WEATHER_API_KEY=your-key-here` is in `.env`
- `.env` should NOT be committed to Git (add to `.gitignore`)

### Testing Locally

```bash
# Test with .env
npm run dev

# Test production config locally (not recommended)
NODE_ENV=production npm run build && npm start
```

## Security Best Practices

✅ **DO:**
- Use `SecureString` type in Parameter Store for sensitive values
- Store `.env` in `.gitignore`
- Use IAM roles instead of static credentials
- Enable CloudTrail logging for Parameter Store access
- Rotate API keys regularly

❌ **DON'T:**
- Commit `.env` files to Git
- Store secrets in Docker images
- Use static AWS credentials
- Store secrets in environment variables in Dockerfile

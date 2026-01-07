# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| 1.x.x   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please do the following:

1. **Do NOT** open a public issue
2. Email the maintainer directly or use GitHub's private vulnerability reporting
3. Include detailed steps to reproduce the vulnerability
4. Allow reasonable time for a fix before public disclosure

## Security Best Practices

When deploying Ollama Proxy:

1. **Always change the default password** before deploying to production
2. **Use HTTPS** in production (configure a reverse proxy like nginx or traefik)
3. **Limit network access** to trusted IPs if possible
4. **Regularly rotate API tokens**
5. **Keep Docker and dependencies updated**
6. **Use strong, unique passwords**

## Known Security Considerations

- API tokens are stored in plaintext in the container volume
- Sessions are stored in memory and will be cleared on restart
- The WebUI password is passed via environment variable

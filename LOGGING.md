# Logging System Documentation

## Overview

This application uses a comprehensive logging system built with Winston to capture all errors, requests, and system events for better debugging and monitoring.

## Log Structure

### Log Files Location

```
backend/logs/
├── app-YYYY-MM-DD.log          # Application logs
├── api-YYYY-MM-DD.log          # API request/response logs
├── auth-YYYY-MM-DD.log         # Authentication logs
├── booking-YYYY-MM-DD.log      # Booking-related logs
├── trek-YYYY-MM-DD.log         # Trek-related logs
├── vendor-YYYY-MM-DD.log       # Vendor panel logs
├── admin-YYYY-MM-DD.log        # Admin panel logs
├── database-YYYY-MM-DD.log     # Database query logs
├── payment-YYYY-MM-DD.log      # Payment processing logs
├── email-YYYY-MM-DD.log        # Email sending logs
├── error-YYYY-MM-DD.log        # Error logs (all categories)
└── general-YYYY-MM-DD.log      # General logs
```

### Log Levels

-   **ERROR**: Critical errors that need immediate attention
-   **WARN**: Warning messages for potential issues
-   **INFO**: General information about system operations
-   **DEBUG**: Detailed debugging information (development only)

## Log Format

Each log entry includes:

```json
{
  "timestamp": "2024-01-15 10:30:45",
  "level": "ERROR",
  "message": "Failed to delete trek",
  "requestId": "delete-trek-1705311045000",
  "trekId": 123,
  "vendorId": 456,
  "duration": "1500ms",
  "error": "foreign key constraint fails",
  "stack": "Error stack trace...",
  "method": "DELETE",
  "url": "/api/vendor/treks/123",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "body": {...},
  "params": {...},
  "query": {...}
}
```

## Trek Operations Logging

### Create Trek

-   **Start**: Logs request details, vendor ID, trek data
-   **Validation**: Logs validation errors with specific field details
-   **Success**: Logs successful creation with trek ID and duration
-   **Error**: Logs detailed error information with stack trace

### Update Trek

-   **Start**: Logs request details, trek ID, update data
-   **Validation**: Logs validation errors and access issues
-   **Success**: Logs successful update with duration
-   **Error**: Logs detailed error information

### Delete Trek

-   **Start**: Logs request details and trek information
-   **Cascade**: Logs each deletion step (images, stages, batches, etc.)
-   **Success**: Logs successful deletion with cleanup summary
-   **Error**: Logs detailed error information for each step

## Error Analysis

### Running Error Analysis

```bash
# Analyze all errors
npm run logs:analyze

# Analyze only trek-related errors
npm run logs:analyze:trek
```

### Analysis Output

The error analyzer provides:

-   **Summary**: Total errors, categories, time range
-   **Top Issues**: Most common error patterns
-   **Recommendations**: Actionable suggestions based on error patterns
-   **Trends**: Hourly error distribution
-   **Detailed Report**: JSON file with complete analysis

### Error Patterns Detected

-   **Trek Operations**: Create, update, delete, validation failures
-   **Database Issues**: Connection, query, constraint, timeout errors
-   **Authentication**: Unauthorized, forbidden, token issues
-   **File Operations**: Upload, delete, save failures

## Log Management

### Commands

```bash
# Test logging system
npm run logs:test

# Clear all logs
npm run logs:clear

# Analyze errors
npm run logs:analyze
```

### Log Rotation

-   **File Size**: Maximum 20MB per log file
-   **Retention**:
    -   General logs: 14 days
    -   Error logs: 30 days
    -   Debug logs: 7 days (development only)

### Log Categories

#### Trek Logs (`trek-*.log`)

-   Trek creation, updates, deletions
-   Validation errors
-   Related data operations (stages, batches, images)
-   Performance metrics

#### API Logs (`api-*.log`)

-   All HTTP requests and responses
-   Request duration
-   Status codes
-   User agent and IP information

#### Error Logs (`error-*.log`)

-   All error-level logs from all categories
-   Stack traces
-   Request context
-   Error categorization

## Debugging Common Issues

### Trek Deletion Failures

1. Check `trek-error-*.log` for specific error messages
2. Look for foreign key constraint errors
3. Verify all related records are being deleted
4. Check file system permissions for image deletion

### Validation Errors

1. Check `trek-*.log` for validation failure details
2. Look for specific field validation errors
3. Verify request data format
4. Check middleware validation rules

### Authentication Issues

1. Check `auth-*.log` for authentication failures
2. Look for token validation errors
3. Verify user session data
4. Check middleware configuration

### Database Issues

1. Check `database-*.log` for query errors
2. Look for connection timeout errors
3. Verify database server status
4. Check connection pool settings

## Best Practices

### For Developers

1. **Use Structured Logging**: Always include relevant context
2. **Log at Appropriate Levels**: ERROR for failures, INFO for operations, DEBUG for details
3. **Include Request Context**: Always log requestId, userId, IP, etc.
4. **Handle Errors Gracefully**: Log errors but don't expose sensitive data

### For Operations

1. **Monitor Error Logs**: Set up alerts for ERROR level logs
2. **Regular Analysis**: Run error analysis weekly
3. **Log Retention**: Keep error logs for at least 30 days
4. **Performance Monitoring**: Track request duration trends

## Troubleshooting

### Log Files Not Created

1. Check `logs/` directory exists
2. Verify write permissions
3. Check Winston configuration
4. Restart application

### High Error Volume

1. Run error analysis to identify patterns
2. Check for specific error types
3. Review recent code changes
4. Monitor system resources

### Performance Issues

1. Check log file sizes
2. Monitor disk space
3. Review log rotation settings
4. Consider log level adjustments

## Integration with Monitoring

The logging system can be integrated with:

-   **ELK Stack**: For centralized log management
-   **Splunk**: For log analysis and alerting
-   **Grafana**: For log visualization
-   **Custom Alerts**: Based on error patterns

## Security Considerations

-   **Sensitive Data**: Never log passwords, tokens, or personal information
-   **IP Logging**: Log IP addresses for security monitoring
-   **User Context**: Log user IDs for audit trails
-   **Error Details**: Be careful not to expose system internals in production

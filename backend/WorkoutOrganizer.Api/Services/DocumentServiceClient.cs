using System.Net.Http.Headers;
using System.Text.Json;
using WorkoutOrganizer.Api.Dtos;

namespace WorkoutOrganizer.Api.Services;

public class DocumentServiceClient(HttpClient httpClient, ILogger<DocumentServiceClient> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    public async Task<(DocumentServiceParseResponse? Response, int StatusCode, string? ErrorMessage)> ParseDocumentAsync(
        IFormFile file,
        string lang,
        CancellationToken cancellationToken = default)
    {
        using var content = new MultipartFormDataContent();

        using var fileStream = file.OpenReadStream();
        using var streamContent = new StreamContent(fileStream);
        streamContent.Headers.ContentType = new MediaTypeHeaderValue(
            string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType);

        content.Add(streamContent, "file", file.FileName);
        content.Add(new StringContent(lang), "lang");

        try
        {
            var response = await httpClient.PostAsync("/parse", content, cancellationToken);
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "Document-service responded with status {StatusCode}: {Body}",
                    (int)response.StatusCode,
                    responseBody);

                string? detail = null;
                try
                {
                    using var doc = JsonDocument.Parse(responseBody);
                    if (doc.RootElement.TryGetProperty("detail", out var detailElem))
                    {
                        detail = detailElem.GetString();
                    }
                }
                catch
                {
                    detail = responseBody;
                }

                return (null, (int)response.StatusCode, detail);
            }

            var parsed = JsonSerializer.Deserialize<DocumentServiceParseResponse>(responseBody, JsonOptions);
            return (parsed, (int)response.StatusCode, null);
        }
        catch (HttpRequestException ex)
        {
            logger.LogError(ex, "Failed to connect to document-service");
            return (null, StatusCodes.Status503ServiceUnavailable, "Document service is unavailable.");
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogError(ex, "Timeout connecting to document-service");
            return (null, StatusCodes.Status504GatewayTimeout, "Document service request timed out.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error calling document-service");
            return (null, StatusCodes.Status500InternalServerError, "Error processing document.");
        }
    }
}

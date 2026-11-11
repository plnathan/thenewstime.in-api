-- Powershell script
$apiUrl = "http://localhost:5000/api/v1/advertisements/tracking/impressions/batch"

$eventId = [guid]::NewGuid().ToString()

$event = @{
    advertisementId = 2768
    placementId = 506
    placementRuleId = 1789
    scheduleId = 1017
    creativeId = 622
    pageType = "HOME"
    placementType = "HOME_TOP"
    pageUrl = "http://localhost:3000/"
    clientEventId = $eventId
    visitorId = [guid]::NewGuid().ToString()
}

$body = @{
    events = @($event)
} | ConvertTo-Json -Depth 10

$jobs = 1..2 | ForEach-Object {
    Start-Job -ScriptBlock {
        param($url, $payload)

        try {
            Invoke-RestMethod `
                -Uri $url `
                -Method POST `
                -ContentType "application/json" `
                -Body $payload
        }
        catch {
            $_.Exception.Message
        }
    } -ArgumentList $apiUrl, $body
}

$jobs | Wait-Job | Receive-Job
$jobs | Remove-Job

-- To verify sql result

SELECT
    client_event_id,
    COUNT(*) AS record_count
FROM advertisement_impressions
WHERE client_event_id = 'ce790284-a7a1-468c-b0b7-3964ef7e523c'
GROUP BY client_event_id;

----------------------------------
-- Powershell

-- Impression-cap concurrency:

$apiUrl = "http://localhost:5000/api/v1/advertisements/tracking/impressions/batch"

$baseEvent = @{
    advertisementId = 2768
    placementId = 506
    placementRuleId = 1789
    scheduleId = 1017
    creativeId = 622
    pageType = "HOME"
    placementType = "HOME_TOP"
    pageUrl = "http://localhost:3000/"
    visitorId = [guid]::NewGuid().ToString()
}

$jobs = 1..2 | ForEach-Object {

    $event = $baseEvent.Clone()
    $event.clientEventId = [guid]::NewGuid().ToString()

    $body = @{
        events = @($event)
    } | ConvertTo-Json -Depth 10

    Start-Job -ScriptBlock {
        param($url, $payload)

        try {
            Invoke-RestMethod `
                -Uri $url `
                -Method POST `
                -ContentType "application/json" `
                -Body $payload
        }
        catch {
    Write-Output "HTTP ERROR: $($_.Exception.Message)"

    if ($_.ErrorDetails.Message) {
        Write-Output "API RESPONSE:"
        Write-Output $_.ErrorDetails.Message
    }
}

    } -ArgumentList $apiUrl, $body
}

$jobs | Wait-Job | Receive-Job
$jobs | Remove-Job

function getLocalReply(message) {
    const text = message.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

    if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(text)) {
        return "Hi! 👋 I’m Binny. I can help you report a waste spot, vote on a report, understand cleanup statuses, or use the heatmap.";
    }

    if (/\b(help|what can you do|what do you do)\b/.test(text)) {
        return "I can explain how to submit a waste report, add a photo or location, vote to confirm a report, check cleanup statuses, and view the live heatmap. What would you like to know?";
    }

    if (/\b(report|submit|create|file)\b/.test(text) && /\b(waste|garbage|rubbish|spot|complaint|hotspot|trash)\b/.test(text)) {
        return "To report a waste spot, open Overview and fill in “Report a Waste Hotspot.” Describe what you found, check the latitude and longitude (or use your location), optionally add a photo, then submit.";
    }

    if (/\b(photo|image|picture|upload)\b/.test(text)) {
        return "A photo is optional. When submitting a report, choose a JPG, PNG, or WebP image up to 5 MB. Please only upload a photo relevant to the waste spot.";
    }

    if (/\b(vote|confirm|upvote)\b/.test(text)) {
        return "Use the Vote button on a report to confirm that the waste spot is still there. Reports within about 150 metres are treated as nearby, so you may be asked to vote instead of creating a duplicate.";
    }

    if (/\b(status|pending|in progress|resolved|track|progress)\b/.test(text)) {
        return "Pending means the report is waiting for cleanup. In Progress means cleanup is underway. Resolved means the spot has been cleaned. You can see each report’s current status in Recent Reports.";
    }

    if (/\b(risk|priority|high risk|medium risk|score)\b/.test(text)) {
        return "Risk and priority help cleanup teams decide what to handle first. The app considers details in the report and nearby confirmations; urgent hazards should also be reported directly to your local authorities.";
    }

    if (/\b(map|heatmap|black ?spot|hotspot|location)\b/.test(text)) {
        return "Open Live Heatmap in the left menu to see active report locations. Select All, Today, Week, or Month to filter the displayed reports.";
    }

    if (/\b(admin|administrator|sign in|login|password)\b/.test(text)) {
        return "The Admin Portal is for authorized cleanup coordinators. The local demo login is admin@ecotrack.com with password admin@123. Change demo credentials and configure a private JWT_SECRET before using it beyond a local demo.";
    }

    if (/\b(thank|thanks|thank you)\b/.test(text)) {
        return "You’re welcome! 🌱 Thanks for helping keep your community clean.";
    }

    if (/\b(sort|segregat|recycl|recycle)\b/.test(text)) {
        return "As a general starting point, keep recyclables, food/organic waste, and hazardous waste separate, and follow your local municipality’s collection rules. Don’t place batteries, chemicals, or medical waste in regular bins.";
    }

    return null;
}

module.exports = { getLocalReply };

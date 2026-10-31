const test = require('node:test');
const assert = require('node:assert/strict');
const { getLocalReply } = require('./chatbot');

test('answers common EcoTrack questions without an AI service', () => {
    const cases = [
        ['How do I report garbage?', 'Report a waste spot'],
        ['Can I add a photo?', 'photo is optional'],
        ['How do I vote?', 'Vote button'],
        ['What does in progress mean?', 'cleanup is underway'],
        ['Where is the heatmap?', 'Live Heatmap'],
        ['How do I sign in as admin?', 'Admin Portal'],
        ['How should I sort recycling?', 'keep recyclables']
    ];

    for (const [question, expected] of cases) {
        assert.match(getLocalReply(question), new RegExp(expected, 'i'), question);
    }
});

test('returns null for questions outside the local FAQ', () => {
    assert.equal(getLocalReply('Can you write a poem about the rain?'), null);
});

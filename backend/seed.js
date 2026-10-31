const { db } = require('./firebase');

const complaints = [
    {
        id: '1',
        userId: 'admin',
        imageUrl: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=500&q=80',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        location: { lat: 28.7041, lng: 77.1025 }, // Delhi
        status: 'Pending',
        riskLevel: 'High',
        priorityScore: 85,
        alertTrigger: 'Immediate Action Required',
        description: 'Large pile of garbage near the market area.'
    },
    {
        id: '2',
        userId: 'admin',
        imageUrl: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=500&q=80',
        timestamp: new Date().toISOString(),
        location: { lat: 28.7050, lng: 77.1030 }, // Close to Delhi
        status: 'In Progress',
        riskLevel: 'High',
        priorityScore: 82,
        alertTrigger: 'Immediate Action Required',
        description: 'Construction debris blocking footpath.'
    },
    {
        id: '3',
        userId: 'admin',
        imageUrl: 'https://images.unsplash.com/photo-1595278069441-2cf29f8005a4?w=500&q=80',
        timestamp: new Date().toISOString(),
        location: { lat: 28.5355, lng: 77.3910 }, // Noida
        status: 'Pending',
        riskLevel: 'Medium',
        priorityScore: 55,
        alertTrigger: 'Schedule Cleanup',
        description: 'Plastic waste scattered in park.'
    },
    {
        id: '4',
        userId: 'system',
        imageUrl: '',
        timestamp: new Date().toISOString(),
        location: { lat: 28.5360, lng: 77.3920 }, // Close to Noida
        status: 'Resolved',
        riskLevel: 'Low',
        priorityScore: 25,
        alertTrigger: 'Routine Cleanup',
        description: 'Minor litter near street lamp.'
    },
    {
        id: '5',
        userId: 'system',
        imageUrl: '',
        timestamp: new Date().toISOString(),
        location: { lat: 28.6139, lng: 77.2090 }, // Central Delhi
        status: 'Pending',
        riskLevel: 'High',
        priorityScore: 88,
        alertTrigger: 'Immediate Action Required',
        description: 'Overflowing dumpsters.'
    }
];

async function seed() {
    if (!db) {
        console.log("Firebase not connected. Cannot seed.");
        process.exit(1);
    }
    
    console.log("Seeding database with mock data...");
    
    // We want to save the complaints as an object mapping id to the complaint object
    const complaintsObj = {};
    for (let c of complaints) {
        complaintsObj[c.id] = c;
    }
    
    try {
        await db.ref('complaints').set(complaintsObj);
        console.log("Successfully added all old items to the database!");
        process.exit(0);
    } catch (e) {
        console.error("Error seeding:", e);
        process.exit(1);
    }
}

seed();

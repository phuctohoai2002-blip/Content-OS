const mockData = {
    niches: [
        { id: "ALL", code: "MASTER", name: "All Niches" },
        { id: "FAS", code: "FAS", name: "Fashion" },
        { id: "GRM", code: "GRM", name: "Men's Grooming" },
        { id: "DIG", code: "DIG", name: "Digital / Creative" }
    ],
    stats: { niches: 3, creators: 182, sources: 1247, content: 536, ready: 28, published: 214, views: "2.4M", followers: "+8.2K" },
    videos: [
        { id:"VID-DIG-001", niche:"DIG", pillar:"Design Analysis", topic:"Poster Analysis", creator:"DesignLab CN", platform:"TikTok", title:"Why does this poster look expensive?", hook:"This poster looks expensive for a reason.", caption:"3 design choices that make a poster feel premium.", status:"ready", publishedAt:null, scheduledAt:null, views:0, likes:0, comments:0, shares:0, saves:0, followers:0 },
        { id:"VID-GRM-002", niche:"GRM", pillar:"Hair Styling", topic:"Hair Volume", creator:"男士研究所", platform:"Facebook Reels", title:"3 mistakes making hair look flat", hook:"Your hair may look flat because of these 3 mistakes.", caption:"Fix these 3 small mistakes to make your hairstyle look fuller.", status:"editing", publishedAt:null, scheduledAt:null, views:0, likes:0, comments:0, shares:0, saves:0, followers:0 },
        { id:"VID-FAS-003", niche:"FAS", pillar:"Fashion Knowledge", topic:"Outfit Proportion", creator:"穿搭研究室", platform:"TikTok", title:"Why this outfit looks more expensive", hook:"It is not the price. Look at the proportions.", caption:"The styling trick behind a more expensive-looking outfit.", status:"scheduled", publishedAt:null, scheduledAt:"2026-08-21 18:00", views:0, likes:0, comments:0, shares:0, saves:0, followers:0 },
        { id:"VID-DIG-004", niche:"DIG", pillar:"Photoshop", topic:"Typography", creator:"PS视觉教程", platform:"TikTok", title:"Fix ugly typography in 10 seconds", hook:"If your typography feels wrong, check this first.", caption:"One simple typography adjustment can completely change the design.", status:"published", publishedAt:"2026-08-18 10:00", scheduledAt:null, views:18400, likes:1120, comments:86, shares:214, saves:640, followers:97 },
        { id:"VID-DIG-005", niche:"DIG", pillar:"Design Theory", topic:"Visual Hierarchy", creator:"设计拆解", platform:"Facebook Reels", title:"Why your design has no focal point", hook:"Your design is not bad. Your hierarchy is unclear.", caption:"Learn how visual hierarchy guides the viewer's eye.", status:"published", publishedAt:"2026-08-17 18:00", scheduledAt:null, views:32700, likes:2080, comments:143, shares:390, saves:1210, followers:186 },
        { id:"VID-FAS-006", niche:"FAS", pillar:"Styling", topic:"Color Matching", creator:"男装观察", platform:"TikTok", title:"3 color combinations that always work", hook:"Save these 3 color combinations for your next outfit.", caption:"Three easy color combinations that make styling much easier.", status:"download", publishedAt:null, scheduledAt:null, views:0, likes:0, comments:0, shares:0, saves:0, followers:0 }
    ],
    topPillars: [
        { name:"Design Theory", niche:"DIG", views:"32.7K", videos:1 },
        { name:"Photoshop", niche:"DIG", views:"18.4K", videos:1 },
        { name:"Fashion Knowledge", niche:"FAS", views:"0", videos:1 },
        { name:"Hair Styling", niche:"GRM", views:"0", videos:1 }
    ],
    recentContent: [
        { id:"VID-DIG-001", title:"Why does this poster look expensive?", niche:"Digital", pillar:"Design Analysis", status:"Ready" },
        { id:"VID-GRM-002", title:"3 mistakes making hair look flat", niche:"Grooming", pillar:"Hair Styling", status:"Editing" },
        { id:"VID-FAS-003", title:"Why this outfit looks more expensive", niche:"Fashion", pillar:"Fashion Knowledge", status:"Scheduled" }
    ]
};
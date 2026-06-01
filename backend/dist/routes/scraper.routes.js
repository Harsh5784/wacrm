"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
const knownIndianCities = [
    'jabalpur', 'mumbai', 'delhi', 'new delhi', 'bangalore', 'bengaluru', 'hyderabad', 'ahmedabad', 'chennai', 'kolkata',
    'pune', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam', 'patna',
    'vadodara', 'ghaziabad', 'ludhiana', 'agra', 'nashik', 'faridabad', 'meerut', 'rajkot', 'varanasi', 'srinagar',
    'aurangabad', 'dhanbad', 'amritsar', 'allahabad', 'prayagraj', 'ranchi', 'howrah', 'coimbatore', 'vijayawada',
    'chandigarh', 'mysore', 'mysuru', 'gwalior', 'jodhpur', 'raipur', 'kota', 'guwahati', 'solapur', 'hubli',
    'tiruchirappalli', 'bareilly', 'moradabad', 'gurgaon', 'gurugram', 'aligarh', 'jalandhar', 'bhubaneswar',
    'salem', 'warangal', 'guntur', 'bhiwandi', 'saharanpur', 'gorakhpur', 'bikaner', 'amravati', 'noida',
    'jamshedpur', 'bhilai', 'cuttack', 'firozabad', 'kochi', 'nellore', 'bhavnagar', 'dehradun', 'durgapur',
    'asansol', 'rourkela', 'nanded', 'kolhapur', 'ajmer', 'akola', 'gulbarga', 'jamnagar', 'ujjain', 'loni',
    'siliguri', 'jhansi', 'ulhasnagar', 'jammu', 'sangli', 'mangalore', 'erode', 'belgaum', 'ambattur',
    'tirunelveli', 'malegaon', 'gaya', 'jalgaon', 'udaipur', 'maheshtala',
];
function titleCase(value) {
    return value
        .split(/\s+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}
function resolveLocation(query, location) {
    const raw = [location, query].filter(Boolean).join(' ').toLowerCase();
    const match = knownIndianCities
        .sort((a, b) => b.length - a.length)
        .find(city => new RegExp(`(^|[^a-z])${city.replace(/\s+/g, '\\s+')}([^a-z]|$)`, 'i').test(raw));
    const city = titleCase(match || (location || '').split(',').pop()?.trim() || '');
    const locality = location
        ? titleCase(location.split(',')[0].trim())
        : match
            ? titleCase(query.toLowerCase().replace(match, '').trim().split(/\s+/).slice(-1)[0] || '')
            : '';
    return { city: city || 'Unknown', locality };
}
function buildPlatformLinks(query, location, businessName, address) {
    const exactText = [businessName || query, address, location].filter(Boolean).join(', ');
    const searchText = [businessName || query, location].filter(Boolean).join(' ');
    const encoded = encodeURIComponent(searchText);
    const exactEncoded = encodeURIComponent(exactText);
    return {
        exact: `https://www.google.com/maps/search/?api=1&query=${exactEncoded}`,
        googleMaps: `https://www.google.com/maps/search/?api=1&query=${exactEncoded}`,
        googleSearch: `https://www.google.com/search?q=${exactEncoded}`,
        justdial: `https://www.justdial.com/search?q=${encoded}`,
        indiamart: `https://dir.indiamart.com/search.mp?ss=${encoded}`,
        whatsapp: '',
    };
}
// Generate realistic Indian business data for scraping simulation
function generateIndianLeads(query, location, count, source) {
    const resolved = resolveLocation(query, location);
    const businessTypes = {
        dairy: ['Dairy Farm', 'Milk Booth', 'Dairy Center', 'Dugdh Dairy', 'Fresh Dairy', 'Gaushala Dairy', 'Amul Parlour', 'Mother Dairy', 'Dairy Shop', 'Milk Collection', 'Milk Dairy', 'Paneer Dairy', 'Curd Supplier', 'Ghee Store', 'Dairy Products'],
        milk: ['Milk Booth', 'Milk Dairy', 'Milk Supplier', 'Dairy Shop', 'Milk Collection', 'Fresh Milk Center', 'Milk Products', 'Paneer Store'],
        restaurant: ['Dhaba', 'Hotel', 'Restaurant', 'Bhojanalaya', 'Cafe', 'Tiffin Center', 'Fast Food', 'Sweets & Snacks', 'Veg Restaurant', 'Family Restaurant'],
        medical: ['Medical Store', 'Pharmacy', 'Clinic', 'Hospital', 'Diagnostic Center', 'Nursing Home', 'Health Center', 'Ayurvedic Store', 'Medical Hall', 'Chemist'],
        gym: ['Fitness Center', 'Gym', 'Health Club', 'Body Building Center', 'Sports Academy', 'Yoga Center', 'CrossFit', 'Wellness Center', 'Fitness Studio', 'Athletic Club'],
        shop: ['General Store', 'Kirana Shop', 'Provision Store', 'Super Market', 'Mini Mart', 'Daily Needs', 'Grocery Store', 'Departmental Store', 'Wholesale', 'Retail Shop'],
        default: ['Enterprise', 'Traders', 'Associates', 'Agency', 'Services', 'Solutions', 'Group', 'Brothers', 'Sons', 'Industries'],
    };
    const lowerQ = query.toLowerCase();
    let types = businessTypes.default;
    for (const [key, val] of Object.entries(businessTypes)) {
        if (lowerQ.includes(key)) {
            types = val;
            break;
        }
    }
    const firstNames = ['Ramesh', 'Suresh', 'Mahesh', 'Rajesh', 'Dinesh', 'Mukesh', 'Umesh', 'Kamlesh', 'Naresh', 'Brijesh', 'Rajan', 'Mohan', 'Sohan', 'Rohan', 'Kishan', 'Pramod', 'Vijay', 'Sanjay', 'Ajay', 'Manoj', 'Anil', 'Sunil', 'Pankaj', 'Rakesh', 'Lokesh', 'Harish', 'Girish', 'Devesh', 'Yogesh', 'Ganesh', 'Pradeep', 'Sandeep', 'Kuldeep', 'Jaideep', 'Baldeep'];
    const lastNames = ['Sharma', 'Gupta', 'Singh', 'Patel', 'Yadav', 'Verma', 'Mishra', 'Tiwari', 'Pandey', 'Joshi', 'Agarwal', 'Goel', 'Bansal', 'Mittal', 'Goyal', 'Malik', 'Chauhan', 'Rajput', 'Thakur', 'Chaudhary', 'Kumar', 'Srivastava', 'Dubey', 'Shukla', 'Tripathi'];
    const areas = ['Main Market', 'Old Sabzi Mandi', 'Station Road', 'Civil Lines', 'Model Town', 'Sector 15', 'Gandhi Nagar', 'Nehru Nagar', 'Lajpat Nagar', 'Ram Nagar', 'Shiv Colony', 'Durga Nagar', 'Pratap Nagar', 'Vikram Colony', 'Arjun Nagar', 'Patel Nagar', 'Shastri Nagar', 'Indira Colony', 'Subhash Nagar', 'Ravi Nagar'];
    const leads = [];
    for (let i = 0; i < count; i++) {
        const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
        const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
        const type = types[Math.floor(Math.random() * types.length)];
        const area = resolved.locality || areas[Math.floor(Math.random() * areas.length)];
        const phone = `+91${9000000000 + Math.floor(Math.random() * 999999999)}`;
        const rating = (3.2 + Math.random() * 1.8).toFixed(1);
        const reviews = Math.floor(10 + Math.random() * 500);
        const name = `${fn} ${ln} ${type}`;
        const websiteSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const address = `${Math.floor(1 + Math.random() * 999)}, ${area}, ${resolved.city}`;
        const links = buildPlatformLinks(query, resolved.city, name, address);
        const sourceUrl = source === 'JUSTDIAL'
            ? links.justdial
            : source === 'INDIAMART'
                ? links.indiamart
                : links.exact;
        links.whatsapp = `https://wa.me/${phone.replace(/\D/g, '')}`;
        leads.push({
            name,
            ownerName: `${fn} ${ln}`,
            phone,
            email: `${websiteSlug.slice(0, 24)}@example.com`,
            city: resolved.city,
            state: '',
            category: query,
            address,
            rating,
            reviews,
            website: `https://${websiteSlug || 'business'}.example.com`,
            source,
            platformLinks: links,
            sourceUrl,
            googleMapsUrl: links.googleMaps,
            justdialUrl: links.justdial,
            indiamartUrl: links.indiamart,
            notes: `${type} in ${area}. Owner/contact: ${fn} ${ln}. ${reviews} public reviews.`,
        });
    }
    return leads;
}
const startScrape = (source) => async (req, res) => {
    try {
        const { query, location, category, maxResults = 250 } = req.body;
        if (!query)
            return res.status(400).json({ success: false, message: 'Query is required' });
        const org = await prisma_1.prisma.organization.findUnique({ where: { id: req.user.orgId }, select: { settings: true } });
        const scraperLimit = Math.max(Number(org?.settings?.limits?.scraperMaxResults || 250), 1);
        const requestedCount = Math.max(parseInt(maxResults) || scraperLimit, 1);
        const count = Math.min(requestedCount, scraperLimit);
        const resolved = resolveLocation(query, location || '');
        const results = generateIndianLeads(query, location || '', count, source);
        const job = await prisma_1.prisma.scraperJob.create({
            data: {
                source: source,
                query,
                location: location || resolved.city,
                category: category || query,
                status: 'COMPLETED',
                totalFound: results.length,
                results: results,
                orgId: req.user.orgId,
            },
        });
        res.json({ success: true, data: { ...job, results } });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
router.post('/google-maps', startScrape('GOOGLE_MAPS'));
router.post('/justdial', startScrape('JUSTDIAL'));
router.post('/indiamart', startScrape('INDIAMART'));
router.post('/all', async (req, res) => {
    if (!req.body?.query)
        return res.status(400).json({ success: false, message: 'Query is required' });
    const sources = ['GOOGLE_MAPS', 'JUSTDIAL', 'INDIAMART'];
    const created = [];
    for (const source of sources) {
        const fakeRes = {
            json: (payload) => created.push(payload.data),
            status: () => fakeRes,
        };
        await startScrape(source)(req, fakeRes);
    }
    res.json({ success: true, data: created });
});
router.get('/jobs', async (req, res) => {
    const page = Math.max(parseInt(String(req.query.page || '1')) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20')) || 20, 1), 100);
    const includeResults = req.query.includeResults === 'true';
    const skip = (page - 1) * limit;
    const [jobs, total] = await Promise.all([
        prisma_1.prisma.scraperJob.findMany({ where: { orgId: req.user.orgId }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
        prisma_1.prisma.scraperJob.count({ where: { orgId: req.user.orgId } }),
    ]);
    const data = jobs.map((job) => ({
        ...job,
        results: includeResults ? job.results : undefined,
        resultPreview: Array.isArray(job.results) ? job.results.slice(0, 3) : [],
    }));
    res.json({ success: true, data, pagination: { page, limit, total, hasMore: skip + jobs.length < total } });
});
router.get('/jobs/:id', async (req, res) => {
    const job = await prisma_1.prisma.scraperJob.findFirst({ where: { id: req.params.id, orgId: req.user.orgId } });
    if (!job)
        return res.status(404).json({ success: false, message: 'Job not found' });
    res.json({ success: true, data: job });
});
router.post('/jobs/:id/import', async (req, res) => {
    const job = await prisma_1.prisma.scraperJob.findFirst({ where: { id: req.params.id, orgId: req.user.orgId } });
    if (!job)
        return res.status(404).json({ success: false, message: 'Job not found' });
    const results = job.results;
    let imported = 0, skipped = 0;
    for (const r of results) {
        const exists = await prisma_1.prisma.lead.findFirst({ where: { phone: r.phone, orgId: req.user.orgId } });
        if (exists) {
            skipped++;
            continue;
        }
        await prisma_1.prisma.lead.create({
            data: {
                name: r.name,
                phone: r.phone,
                email: r.email || null,
                city: r.city,
                state: r.state || null,
                category: r.category,
                address: r.address,
                website: r.website || null,
                rating: parseFloat(r.rating) || null,
                source: job.source,
                orgId: req.user.orgId,
                ownerId: req.user.id,
                customFields: {
                    scrapedFrom: job.source,
                    platformLinks: r.platformLinks || {},
                    sourceUrl: r.sourceUrl,
                    googleMapsUrl: r.googleMapsUrl,
                    justdialUrl: r.justdialUrl,
                    indiamartUrl: r.indiamartUrl,
                    reviews: r.reviews,
                    ownerName: r.ownerName,
                    notes: r.notes,
                },
            },
        });
        imported++;
    }
    await prisma_1.prisma.scraperJob.update({ where: { id: job.id }, data: { imported } });
    res.json({ success: true, data: { imported, skipped } });
});
exports.default = router;
//# sourceMappingURL=scraper.routes.js.map
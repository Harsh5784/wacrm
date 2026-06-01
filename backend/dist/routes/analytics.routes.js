"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// analytics.routes.ts
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const analytics_controller_1 = require("../controllers/analytics.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/dashboard', analytics_controller_1.getDashboardStats);
router.get('/', analytics_controller_1.getAnalytics);
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map
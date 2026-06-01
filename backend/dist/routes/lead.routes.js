"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const lead_controller_1 = require("../controllers/lead.controller");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router.use(auth_middleware_1.authenticate);
router.get('/stats', lead_controller_1.getLeadStats);
router.get('/export', lead_controller_1.exportLeads);
router.get('/', lead_controller_1.getLeads);
router.post('/', lead_controller_1.createLead);
router.post('/import', upload.single('file'), lead_controller_1.importLeads);
router.post('/bulk-delete', lead_controller_1.bulkDeleteLeads);
router.get('/:id', lead_controller_1.getLead);
router.put('/:id', lead_controller_1.updateLead);
router.delete('/:id', lead_controller_1.deleteLead);
router.post('/:id/notes', lead_controller_1.addNote);
exports.default = router;
//# sourceMappingURL=lead.routes.js.map
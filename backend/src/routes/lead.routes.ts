import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.middleware';
import {
  getLeads, getLead, createLead, updateLead, deleteLead,
  importLeads, exportLeads, addNote, getLeadStats, bulkDeleteLeads,
} from '../controllers/lead.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate);

router.get('/stats', getLeadStats);
router.get('/export', exportLeads);
router.get('/', getLeads);
router.post('/', createLead);
router.post('/import', upload.single('file'), importLeads);
router.post('/bulk-delete', bulkDeleteLeads);
router.get('/:id', getLead);
router.put('/:id', updateLead);
router.delete('/:id', deleteLead);
router.post('/:id/notes', addNote);

export default router;

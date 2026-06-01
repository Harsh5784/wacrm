"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnv = loadEnv;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function parseEnvLine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#'))
        return null;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1)
        return null;
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (!key)
        return null;
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
    }
    return { key, value };
}
function loadEnv() {
    const backendDir = path_1.default.resolve(__dirname, '../..');
    const candidates = [
        path_1.default.join(process.cwd(), '.env'),
        path_1.default.join(process.cwd(), 'backend/.env'),
        path_1.default.join(backendDir, '.env'),
    ];
    const envPath = candidates.find(candidate => fs_1.default.existsSync(candidate));
    if (!envPath)
        return;
    const content = fs_1.default.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
        const parsed = parseEnvLine(line);
        if (!parsed || process.env[parsed.key] !== undefined)
            continue;
        process.env[parsed.key] = parsed.value;
    }
}
//# sourceMappingURL=env.js.map
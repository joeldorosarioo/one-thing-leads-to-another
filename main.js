'use strict';
// Build output. Do not edit: change src/ and run npm run build.
module.exports = (function loadPlugin(modules) {
  const cache = Object.create(null);

  function resolveModule(request, parent) {
    const segments = parent.split('/');
    segments.pop();

    for (const segment of request.replace(/\\/g, '/').split('/')) {
      if (segment === '..') segments.pop();
      else if (segment !== '.') segments.push(segment);
    }

    const resolved = segments.join('/');
    return resolved.endsWith('.js') ? resolved : `${resolved}.js`;
  }

  function loadModule(request, parent) {
    if (request === 'obsidian') return require('obsidian');
    if (!request.startsWith('.')) throw new Error(`Unknown external dependency: ${request}`);

    const id = resolveModule(request, parent);
    if (!Object.prototype.hasOwnProperty.call(modules, id)) throw new Error(`Unknown module: ${id}`);

    if (!cache[id]) {
      const module = { exports: {} };
      cache[id] = module;
      modules[id](module, module.exports, dependency => loadModule(dependency, id));
    }

    return cache[id].exports;
  }

  return loadModule('./main', 'entry.js').default;
})({
"application/connections/connection-paths.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConnection = validateConnection;
const path_utils_1 = require("../../shared/path-utils");
function validateConnection(job) {
    for (const key of ['data_path', 'template_path', 'output_path'])
        job[key] = (0, path_utils_1.normalizePath)(job[key]);
    if (!job.data_path.toLowerCase().endsWith('.json'))
        throw new Error('Data source must be a .json file.');
    if (!job.template_path.toLowerCase().endsWith('.md') || !job.output_path.toLowerCase().endsWith('.md')) {
        throw new Error('Template and output must be .md files.');
    }
    if (new Set([job.data_path, job.template_path, job.output_path]).size !== 3) {
        throw new Error('Data, template and output paths must be different.');
    }
    return job;
}

},
"application/connections/connection-service.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConnectionService = createConnectionService;
const path_utils_1 = require("../../shared/path-utils");
const generate_document_1 = require("../document-generation/generate-document");
const connection_paths_1 = require("./connection-paths");
const data_path_1 = require("./data-path");
function createConnectionService(dependencies) {
    const { settings, vault, documents, saveSettings } = dependencies;
    let persistence = Promise.resolve();
    const list = () => settings.jobs;
    const find = (id) => settings.jobs.find(connection => connection.id === id);
    function get(id) {
        const connection = find(id);
        if (!connection)
            throw new Error('Connection not found.');
        return connection;
    }
    function persist() {
        const snapshot = {
            ...settings,
            jobs: settings.jobs.map(connection => {
                const copy = { ...connection };
                delete copy.overwrite_approved;
                return copy;
            })
        };
        persistence = persistence.catch(() => { }).then(() => saveSettings(snapshot));
        return persistence;
    }
    function validate(connection) {
        (0, connection_paths_1.validateConnection)(connection);
        if (!connection.title.trim())
            throw new Error('Connection name is required.');
        for (const other of list()) {
            if (other.id === connection.id)
                continue;
            if (other.output_path === connection.output_path)
                throw new Error('Two document connections cannot write to the same output.');
            if (other.output_path === connection.data_path ||
                other.output_path === connection.template_path ||
                connection.output_path === other.data_path ||
                connection.output_path === other.template_path) {
                throw new Error('An output cannot be a source or template of another connection.');
            }
        }
    }
    async function save(draft, options) {
        const connection = { ...draft };
        delete connection.overwrite_approved;
        if (options.create && !connection.data_path)
            connection.data_path = (0, data_path_1.managedDataPath)(connection.id);
        validate(connection);
        const index = list().findIndex(item => item.id === connection.id);
        if (options.create && index >= 0)
            throw new Error('Connection already exists.');
        if (!options.create && index < 0)
            throw new Error('Connection no longer exists.');
        if (options.create)
            await (0, generate_document_1.createStarterFiles)(vault, connection);
        if (options.format)
            await documents.updateFormats(connection.data_path, options.format);
        if (options.create)
            settings.jobs.push(connection);
        else
            settings.jobs[index] = connection;
        await persist();
    }
    async function remove(id) {
        settings.jobs = list().filter(connection => connection.id !== id);
        await persist();
    }
    async function relocate(oldPath, newPath) {
        let changed = false;
        for (const connection of list()) {
            for (const key of ['data_path', 'template_path', 'output_path']) {
                const next = (0, path_utils_1.relocatePath)(connection[key], oldPath, newPath);
                if (next !== connection[key]) {
                    connection[key] = next;
                    changed = true;
                }
            }
        }
        if (changed)
            await persist();
        return changed;
    }
    return {
        list,
        find,
        get,
        validate,
        persist,
        save,
        remove,
        relocate
    };
}

},
"application/connections/connection-types.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSettings = parseSettings;
const value_guards_1 = require("../../shared/value-guards");
function assertConnection(connection, index) {
    if (!(0, value_guards_1.isRecord)(connection) ||
        typeof connection.id !== 'string' ||
        typeof connection.title !== 'string' ||
        typeof connection.data_path !== 'string' ||
        typeof connection.template_path !== 'string' ||
        typeof connection.output_path !== 'string' ||
        typeof connection.enabled !== 'boolean' ||
        (connection.last_output_hash !== undefined && typeof connection.last_output_hash !== 'string')) {
        throw new Error(`Invalid saved connection at index ${index}.`);
    }
}
function parseSettings(input) {
    if (input == null)
        return { jobs: [] };
    if (!(0, value_guards_1.isRecord)(input))
        throw new Error('Invalid saved settings.');
    if (input.jobs == null)
        return { jobs: [] };
    if (!Array.isArray(input.jobs))
        throw new Error('Invalid saved settings: jobs must be an array.');
    const jobs = input.jobs;
    return {
        jobs: jobs.map((connection, index) => {
            assertConnection(connection, index);
            return connection;
        })
    };
}

},
"application/connections/data-path.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DATA_DIRECTORY = void 0;
exports.managedDataPath = managedDataPath;
exports.DATA_DIRECTORY = 'note-template-sync/data';
function managedDataPath(connectionId) {
    if (!/^[a-zA-Z0-9_-]{3,80}$/.test(connectionId)) {
        throw new Error('Invalid connection identifier.');
    }
    return `${exports.DATA_DIRECTORY}/${connectionId.replace(/_/g, '-').toLowerCase()}.json`;
}

},
"application/document-editing/document-actions.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDocumentActions = createDocumentActions;
function createDocumentActions(dependencies) {
    const { documents, connections, changed } = dependencies;
    async function updateValue(id, key, value) {
        await documents.updateValue(connections.get(id).data_path, key, value);
        await changed(id);
    }
    async function saveField(id, change) {
        await documents.saveField(connections.get(id).data_path, change);
        await changed(id, true);
    }
    async function deleteField(id, selection) {
        await documents.deleteField(connections.get(id).data_path, selection);
        await changed(id, true);
    }
    return {
        updateValue,
        saveField,
        deleteField,
        readSource: async (id) => ({ data: await documents.read(connections.get(id).data_path) }),
        readFormats: documents.readFormats
    };
}

},
"application/document-editing/document-service.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDocumentService = createDocumentService;
const data_model_1 = require("../../domain/data-model");
const error_message_1 = require("../../shared/error-message");
const value_guards_1 = require("../../shared/value-guards");
const vault_port_1 = require("../ports/vault-port");
function createDocumentService(vault) {
    const pending = new Map();
    let disposed = false;
    async function readInput(path) {
        const file = vault.getAbstractFileByPath(path);
        if (!(0, vault_port_1.isVaultFile)(file))
            throw new Error('Data file not found.');
        let input;
        try {
            input = JSON.parse(await vault.read(file));
        }
        catch (error) {
            throw new Error(`Invalid JSON: ${(0, error_message_1.errorMessage)(error)}`);
        }
        return input;
    }
    async function read(path) {
        return (0, data_model_1.parseDocument)(await readInput(path));
    }
    async function write(path, transform) {
        const previous = pending.get(path) ?? Promise.resolve();
        const next = previous
            .catch(() => { })
            .then(async () => {
            if (disposed)
                return;
            const input = await readInput(path);
            if (disposed)
                return;
            const document = transform(input);
            if (!document)
                return;
            (0, data_model_1.validateData)(document);
            const file = vault.getAbstractFileByPath(path);
            if (!(0, vault_port_1.isVaultFile)(file))
                throw new Error('Data file not found.');
            await vault.modify(file, JSON.stringify(document, null, 2) + '\n');
        });
        pending.set(path, next);
        try {
            await next;
        }
        finally {
            if (pending.get(path) === next)
                pending.delete(path);
        }
    }
    function update(path, mutate) {
        return write(path, input => {
            const document = (0, data_model_1.parseDocument)(input);
            mutate(document);
            return document;
        });
    }
    function updateValue(path, key, value) {
        return update(path, document => {
            const field = document.fields.find(item => item.key === key);
            if (!field)
                throw new Error(`Unknown field '${key}'.`);
            field.value = value;
        });
    }
    function saveField(path, change) {
        return update(path, document => {
            const { entity, mode } = change;
            if (mode === 'create' && [...document.fields, ...document.formulas].some(item => item.key === entity.key)) {
                throw new Error('Key already exists.');
            }
            function upsert(items, item) {
                const index = items.findIndex(existing => existing.key === item.key);
                if (mode === 'edit') {
                    if (index < 0)
                        throw new Error('Field was removed.');
                    items[index] = { ...item };
                }
                else {
                    items.push({ ...item });
                }
            }
            if (change.kind === 'formula')
                upsert(document.formulas, change.entity);
            else
                upsert(document.fields, change.entity);
        });
    }
    function deleteField(path, selection) {
        return update(path, document => {
            if (selection.kind === 'formula')
                document.formulas = document.formulas.filter(item => item.key !== selection.key);
            else
                document.fields = document.fields.filter(item => item.key !== selection.key);
        });
    }
    function updateFormats(path, format) {
        return write(path, input => {
            if (!(0, value_guards_1.isRecord)(input))
                throw new Error('Unsupported data file. Expected schema_version: 1.');
            const document = (0, data_model_1.parseDocument)({ ...input, ...format });
            if (input.locale === document.locale && input.currency === document.currency)
                return null;
            return document;
        });
    }
    async function readFormats(path) {
        try {
            const input = await readInput(path);
            return {
                locale: (0, value_guards_1.isRecord)(input) && typeof input.locale === 'string' && input.locale ? input.locale : 'en-US',
                currency: (0, value_guards_1.isRecord)(input) && typeof input.currency === 'string' && input.currency ? input.currency : 'USD'
            };
        }
        catch {
            return { locale: 'en-US', currency: 'USD' };
        }
    }
    return {
        read,
        updateValue,
        saveField,
        deleteField,
        updateFormats,
        readFormats,
        dispose: () => {
            disposed = true;
        }
    };
}

},
"application/document-generation/generate-document.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureFolders = ensureFolders;
exports.createStarterFiles = createStarterFiles;
exports.inspectDocument = inspectDocument;
exports.writeDocument = writeDocument;
exports.generateDocument = generateDocument;
const data_model_1 = require("../../domain/data-model");
const template_renderer_1 = require("../../domain/template-renderer");
const error_message_1 = require("../../shared/error-message");
const connection_paths_1 = require("../connections/connection-paths");
const vault_port_1 = require("../ports/vault-port");
async function ensureFolders(vault, path) {
    const parts = path.split('/');
    parts.pop();
    let parent = '';
    for (const part of parts) {
        parent = parent ? `${parent}/${part}` : part;
        if (!vault.getAbstractFileByPath(parent))
            await vault.createFolder(parent);
    }
}
async function createStarterFiles(vault, connection) {
    (0, connection_paths_1.validateConnection)(connection);
    if (!vault.getAbstractFileByPath(connection.data_path)) {
        await ensureFolders(vault, connection.data_path);
        await vault.create(connection.data_path, JSON.stringify((0, data_model_1.blankDocument)(), null, 2) + '\n');
    }
    if (!vault.getAbstractFileByPath(connection.template_path)) {
        await ensureFolders(vault, connection.template_path);
        await vault.create(connection.template_path, '# {{text:document_title}}\n\nEdit this template to add content and placeholders.\n');
    }
}
async function inspectDocument(vault, connection) {
    (0, connection_paths_1.validateConnection)(connection);
    const source = vault.getAbstractFileByPath(connection.data_path);
    const template = vault.getAbstractFileByPath(connection.template_path);
    if (!(0, vault_port_1.isVaultFile)(source) || !(0, vault_port_1.isVaultFile)(template)) {
        throw new Error('Data source or template not found. Check the configured paths.');
    }
    const [dataText, templateText] = await Promise.all([vault.read(source), vault.read(template)]);
    let input;
    try {
        input = JSON.parse(dataText);
    }
    catch (error) {
        throw new Error(`Invalid JSON data: ${(0, error_message_1.errorMessage)(error)}`);
    }
    const output = (0, template_renderer_1.renderTemplate)(templateText, (0, data_model_1.parseDocument)(input));
    const file = vault.getAbstractFileByPath(connection.output_path);
    if (file && !(0, vault_port_1.isVaultFile)(file))
        throw new Error('Output path is a folder, not a file.');
    const existing = file ? await vault.read(file) : null;
    return {
        output,
        existing,
        status: existing === null ? 'created' : existing === output ? 'unchanged' : 'updated'
    };
}
async function writeDocument(vault, connection, inspection, mayWrite = () => true) {
    const { status, output } = inspection;
    if (status === 'unchanged')
        return status;
    if (!mayWrite())
        return 'cancelled';
    if (status === 'updated') {
        const file = vault.getAbstractFileByPath(connection.output_path);
        if (!(0, vault_port_1.isVaultFile)(file))
            throw new Error('Output path is not a file.');
        await vault.modify(file, output);
    }
    else {
        await ensureFolders(vault, connection.output_path);
        if (!mayWrite())
            return 'cancelled';
        await vault.create(connection.output_path, output);
    }
    return status;
}
async function generateDocument(vault, connection, mayWrite = () => true) {
    return writeDocument(vault, connection, await inspectDocument(vault, connection), mayWrite);
}

},
"application/plugin-actions.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPluginActions = createPluginActions;
const connection_service_1 = require("./connections/connection-service");
const connection_types_1 = require("./connections/connection-types");
const document_actions_1 = require("./document-editing/document-actions");
const document_service_1 = require("./document-editing/document-service");
const sync_action_1 = require("./synchronization/sync-action");
const sync_scheduler_1 = require("./synchronization/sync-scheduler");
const sync_service_1 = require("./synchronization/sync-service");
function createPluginActions(dependencies) {
    const documents = (0, document_service_1.createDocumentService)(dependencies.vault);
    const connections = (0, connection_service_1.createConnectionService)({
        settings: (0, connection_types_1.parseSettings)(dependencies.savedSettings),
        vault: dependencies.vault,
        documents,
        saveSettings: dependencies.saveSettings
    });
    let disposed = false;
    const synchronization = (0, sync_service_1.createSyncService)({
        vault: dependencies.vault,
        connections,
        retry: id => scheduler.schedule(id)
    });
    const scheduler = (0, sync_scheduler_1.createSyncScheduler)({
        isEnabled: id => connections.find(id)?.enabled ?? false,
        run: id => syncConnection(id, { mode: 'automatic' })
    });
    const syncConnection = (0, sync_action_1.createSyncAction)({
        synchronization,
        connections,
        isActive: () => !disposed,
        notify: dependencies.notify,
        refreshSync: dependencies.refreshSync
    });
    async function saveConnection(connection, options = {}) {
        scheduler.cancel(connection.id);
        await connections.save(connection, options);
        if (connections.get(connection.id).enabled) {
            await syncConnection(connection.id, { notify: true, overwriteApproved: options.overwriteApproved });
        }
        await dependencies.refreshEditors();
    }
    async function changed(id, structureChanged = false) {
        if (disposed)
            return;
        scheduler.schedule(id);
        await dependencies.refreshSync(id);
        if (structureChanged)
            await dependencies.refreshEditors();
    }
    async function removeConnection(id) {
        scheduler.cancel(id);
        await connections.remove(id);
        await dependencies.refreshEditors();
    }
    return {
        listConnections: connections.list,
        validateConnection: connections.validate,
        relocateConnections: connections.relocate,
        inspectConnection: synchronization.inspect,
        queueSync: scheduler.schedule,
        saveConnection,
        removeConnection,
        syncConnection,
        ...(0, document_actions_1.createDocumentActions)({ documents, connections, changed }),
        dispose() {
            disposed = true;
            scheduler.dispose();
            synchronization.dispose();
            documents.dispose();
        }
    };
}

},
"application/ports/vault-port.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVaultFile = isVaultFile;
function isVaultFile(value) {
    return Boolean(value && typeof value.extension === 'string');
}

},
"application/synchronization/sync-action.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSyncAction = createSyncAction;
const error_message_1 = require("../../shared/error-message");
function createSyncAction(dependencies) {
    const { synchronization, connections, isActive, notify, refreshSync } = dependencies;
    async function syncConnection(id, options = {}) {
        try {
            const result = await synchronization.generate(id, options);
            if (!isActive())
                return result;
            const title = connections.find(id)?.title ?? id;
            if (options.notify && result === 'conflict') {
                notify(`Connection '${title}': review the existing report before overwriting.`, 7000);
            }
            else if (options.notify && (result === 'created' || result === 'updated')) {
                notify(`Connection '${title}': document ${result}.`);
            }
            return result;
        }
        catch (error) {
            if (isActive())
                notify(`Note Template Sync: ${(0, error_message_1.errorMessage)(error)}`, 8000);
        }
        finally {
            if (isActive())
                await refreshSync(id);
        }
    }
    return syncConnection;
}

},
"application/synchronization/sync-policy.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveSyncControls = deriveSyncControls;
exports.fingerprint = fingerprint;
exports.requiresOverwriteConfirmation = requiresOverwriteConfirmation;
function deriveSyncControls(result, autoSyncEnabled) {
    if (result === 'unchanged')
        return { status: 'up-to-date', canManualSync: false, label: 'Up to date' };
    if (result === 'conflict')
        return { status: 'conflict', canManualSync: true, label: 'Review external changes' };
    if (autoSyncEnabled)
        return { status: 'automatic', canManualSync: false, label: 'Updating automatically…' };
    return { status: 'pending', canManualSync: true, label: 'Pending changes · Auto-sync off' };
}
function fingerprint(content) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < content.length; i++) {
        hash ^= content.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}
function requiresOverwriteConfirmation(generated, existing, lastGeneratedFingerprint) {
    if (existing === null || existing === generated)
        return false;
    if (!lastGeneratedFingerprint)
        return true;
    return fingerprint(existing) !== lastGeneratedFingerprint;
}

},
"application/synchronization/sync-scheduler.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSyncScheduler = createSyncScheduler;
function createSyncScheduler(options) {
    const timers = new Map();
    let disposed = false;
    function cancel(id) {
        const timer = timers.get(id);
        if (timer)
            clearTimeout(timer);
        timers.delete(id);
    }
    function schedule(id) {
        cancel(id);
        if (disposed || !options.isEnabled(id))
            return;
        timers.set(id, setTimeout(() => {
            timers.delete(id);
            if (!disposed && options.isEnabled(id))
                void options.run(id);
        }, options.delay ?? 500));
    }
    function dispose() {
        disposed = true;
        for (const id of timers.keys())
            cancel(id);
    }
    return {
        schedule,
        cancel,
        dispose
    };
}

},
"application/synchronization/sync-service.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSyncService = createSyncService;
const generate_document_1 = require("../document-generation/generate-document");
const vault_port_1 = require("../ports/vault-port");
const sync_policy_1 = require("./sync-policy");
function createSyncService(options) {
    const active = new Map();
    let disposed = false;
    const { vault, connections } = options;
    async function inspect(id) {
        const connection = connections.get(id);
        const inspection = await (0, generate_document_1.inspectDocument)(vault, connection);
        return (0, sync_policy_1.requiresOverwriteConfirmation)(inspection.output, inspection.existing, connection.last_output_hash)
            ? 'conflict'
            : inspection.status;
    }
    async function generate(id, request = {}) {
        const connection = connections.find(id);
        const mayWrite = () => !disposed &&
            connections.find(id) === connection &&
            (request.mode !== 'automatic' || connection?.enabled === true);
        if (!connection || !mayWrite())
            return 'cancelled';
        const pending = active.get(id);
        if (pending) {
            if (request.mode === 'automatic') {
                options.retry(id);
                return;
            }
            await pending;
            return generate(id, request);
        }
        let release;
        active.set(id, new Promise(resolve => {
            release = resolve;
        }));
        try {
            const inspection = await (0, generate_document_1.inspectDocument)(vault, connection);
            const existingFile = vault.getAbstractFileByPath(connection.output_path);
            const existing = (0, vault_port_1.isVaultFile)(existingFile) ? await vault.read(existingFile) : null;
            if ((0, sync_policy_1.requiresOverwriteConfirmation)(inspection.output, existing, connection.last_output_hash) &&
                !request.overwriteApproved)
                return 'conflict';
            const result = await (0, generate_document_1.writeDocument)(vault, connection, inspection, mayWrite);
            if (result !== 'cancelled' && mayWrite()) {
                const nextHash = (0, sync_policy_1.fingerprint)(inspection.output);
                if (connection.last_output_hash !== nextHash) {
                    connection.last_output_hash = nextHash;
                    await connections.persist();
                }
            }
            return result;
        }
        finally {
            active.delete(id);
            release();
        }
    }
    return {
        inspect,
        generate,
        dispose: () => {
            disposed = true;
        }
    };
}

},
"domain/data-model.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_TYPES = exports.VALID_TONES = exports.KEY_PATTERN = exports.isFieldType = exports.isColorRole = exports.checkKey = void 0;
exports.blankDocument = blankDocument;
exports.parseDocument = parseDocument;
exports.validateData = validateData;
const document_validation_1 = require("./document-validation");
const expression_engine_1 = require("./expression-engine");
var document_validation_2 = require("./document-validation");
Object.defineProperty(exports, "checkKey", { enumerable: true, get: function () { return document_validation_2.checkKey; } });
Object.defineProperty(exports, "isColorRole", { enumerable: true, get: function () { return document_validation_2.isColorRole; } });
Object.defineProperty(exports, "isFieldType", { enumerable: true, get: function () { return document_validation_2.isFieldType; } });
Object.defineProperty(exports, "KEY_PATTERN", { enumerable: true, get: function () { return document_validation_2.KEY_PATTERN; } });
Object.defineProperty(exports, "VALID_TONES", { enumerable: true, get: function () { return document_validation_2.VALID_TONES; } });
Object.defineProperty(exports, "VALID_TYPES", { enumerable: true, get: function () { return document_validation_2.VALID_TYPES; } });
function blankDocument() {
    return {
        schema_version: 1,
        locale: 'en-US',
        currency: 'USD',
        fields: [
            {
                key: 'document_title',
                label: 'Document title',
                section: 'General',
                type: 'text',
                tone: 'none',
                value: 'My document'
            }
        ],
        formulas: []
    };
}
function documentValues(document) {
    const fieldValues = Object.create(null);
    const numericValues = Object.create(null);
    for (const field of document.fields) {
        fieldValues[field.key] = field.value;
        if (typeof field.value === 'number')
            numericValues[field.key] = field.value;
    }
    const expressions = Object.create(null);
    for (const formula of document.formulas)
        expressions[formula.key] = formula.expression;
    return { ...fieldValues, ...(0, expression_engine_1.computeValues)(numericValues, expressions) };
}
function parseDocument(input) {
    const document = (0, document_validation_1.readDocument)(input);
    documentValues(document);
    return document;
}
function validateData(input) {
    return documentValues((0, document_validation_1.readDocument)(input));
}

},
"domain/document-types.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},
"domain/document-validation.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_TYPES = exports.VALID_TONES = exports.KEY_PATTERN = void 0;
exports.checkKey = checkKey;
exports.readDocument = readDocument;
exports.isFieldType = isFieldType;
exports.isColorRole = isColorRole;
const value_guards_1 = require("../shared/value-guards");
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
exports.KEY_PATTERN = KEY_PATTERN;
const VALID_TYPES = new Set(['number', 'text', 'date', 'boolean']);
exports.VALID_TYPES = VALID_TYPES;
const VALID_TONES = new Set(['none', 'income', 'expense', 'investment', 'pending', 'auto']);
exports.VALID_TONES = VALID_TONES;
function checkKey(key) {
    if (typeof key !== 'string' || !KEY_PATTERN.test(key))
        throw new Error(`Invalid field key '${key}'. Use snake_case starting with a letter.`);
}
function readDataField(field, index, usedKeys) {
    if (!(0, value_guards_1.isRecord)(field))
        throw new Error(`Invalid field at index ${index}.`);
    checkKey(field.key);
    if (usedKeys.has(field.key))
        throw new Error(`Duplicate field key '${field.key}'.`);
    usedKeys.add(field.key);
    if (typeof field.label !== 'string' || !field.label.trim())
        throw new Error(`Field ${field.key} requires a label.`);
    if (typeof field.section !== 'string')
        throw new Error(`Field ${field.key} requires a section string.`);
    if (!isFieldType(field.type))
        throw new Error(`Unsupported type for ${field.key}.`);
    const tone = field.tone || 'none';
    if (!isColorRole(tone))
        throw new Error(`Invalid color role for ${field.key}.`);
    if (field.type === 'number' && (typeof field.value !== 'number' || !Number.isFinite(field.value)))
        throw new Error(`Field ${field.key} must have a finite number.`);
    if ((field.type === 'text' || field.type === 'date') && typeof field.value !== 'string')
        throw new Error(`Field ${field.key} must contain text.`);
    if (field.type === 'boolean' && typeof field.value !== 'boolean')
        throw new Error(`Field ${field.key} must be true or false.`);
    if (typeof field.value !== 'string' && typeof field.value !== 'number' && typeof field.value !== 'boolean')
        throw new Error(`Invalid value for ${field.key}.`);
    return {
        ...field,
        key: field.key,
        label: field.label,
        section: field.section,
        type: field.type,
        tone,
        value: field.value
    };
}
function readCalculatedField(entry, index, usedKeys) {
    if (!(0, value_guards_1.isRecord)(entry))
        throw new Error(`Invalid formula at index ${index}.`);
    checkKey(entry.key);
    if (usedKeys.has(entry.key))
        throw new Error(`Duplicate field/formula key '${entry.key}'.`);
    usedKeys.add(entry.key);
    if (typeof entry.label !== 'string' || !entry.label.trim())
        throw new Error(`Formula ${entry.key} requires a label.`);
    if (typeof entry.expression !== 'string' || !entry.expression.trim())
        throw new Error(`Formula ${entry.key} requires an expression.`);
    const tone = entry.tone || 'none';
    if (!isColorRole(tone))
        throw new Error(`Invalid color role for formula ${entry.key}.`);
    return { ...entry, key: entry.key, label: entry.label, expression: entry.expression, tone };
}
function readDocument(input) {
    if (!(0, value_guards_1.isRecord)(input) || input.schema_version !== 1)
        throw new Error('Unsupported data file. Expected schema_version: 1.');
    if (!Array.isArray(input.fields) || !Array.isArray(input.formulas || []))
        throw new Error('Data file needs fields and formulas arrays.');
    if (typeof input.locale !== 'string' || typeof input.currency !== 'string')
        throw new Error('locale and currency must be strings.');
    try {
        new Intl.NumberFormat(input.locale, { style: 'currency', currency: input.currency });
    }
    catch (_) {
        throw new Error('Invalid locale or currency code.');
    }
    const usedKeys = new Set();
    const rawFields = input.fields;
    const rawFormulas = Array.isArray(input.formulas) ? input.formulas : [];
    const fields = rawFields.map((field, index) => readDataField(field, index, usedKeys));
    const formulas = rawFormulas.map((formula, index) => readCalculatedField(formula, index, usedKeys));
    return { ...input, schema_version: 1, locale: input.locale, currency: input.currency, fields, formulas };
}
function isFieldType(value) {
    return typeof value === 'string' && VALID_TYPES.has(value);
}
function isColorRole(value) {
    return typeof value === 'string' && VALID_TONES.has(value);
}

},
"domain/expression-engine.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeValues = computeValues;
exports.evaluateExpression = evaluateExpression;
const parser_1 = require("./expressions/parser");
const tokenizer_1 = require("./expressions/tokenizer");
function evaluateExpression(source, resolve) {
    return (0, parser_1.parseExpression)((0, tokenizer_1.tokenizeExpression)(source), resolve);
}
function computeValues(input, formulas = {}) {
    if (!formulas || typeof formulas !== 'object' || Array.isArray(formulas))
        throw new Error('"derived" must be a JSON object.');
    const result = Object.assign(Object.create(null), input);
    const inProgress = new Set();
    function resolve(key) {
        if (Object.prototype.hasOwnProperty.call(result, key))
            return result[key];
        if (!Object.prototype.hasOwnProperty.call(formulas, key))
            throw new Error(`Unknown field in formula: ${key}`);
        if (inProgress.has(key))
            throw new Error(`Circular formula dependency: ${key}`);
        inProgress.add(key);
        try {
            const computed = evaluateExpression(formulas[key], resolve);
            result[key] = computed;
            return computed;
        }
        finally {
            inProgress.delete(key);
        }
    }
    Object.keys(formulas).forEach(key => {
        if (!/^[a-z][a-z0-9_]*$/.test(key))
            throw new Error(`Invalid derived field name: ${key}`);
        if (Object.prototype.hasOwnProperty.call(input, key))
            throw new Error(`Derived field conflicts with an input field: ${key}`);
        resolve(key);
    });
    return result;
}

},
"domain/expressions/math-functions.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MATH_FUNCTIONS = void 0;
exports.MATH_FUNCTIONS = {
    sum: (...values) => values.reduce((total, value) => total + value, 0),
    min: (...values) => {
        if (!values.length)
            throw new Error('min() needs an argument.');
        return Math.min(...values);
    },
    max: (...values) => {
        if (!values.length)
            throw new Error('max() needs an argument.');
        return Math.max(...values);
    },
    abs: (value) => Math.abs(value),
    ceil: (value) => Math.ceil(value),
    floor: (value) => Math.floor(value),
    round: (value, digits = 0) => {
        if (!Number.isInteger(digits) || digits < 0 || digits > 8)
            throw new Error('round() precision must be from 0 to 8.');
        const factor = 10 ** digits;
        return Math.round((value + Number.EPSILON) * factor) / factor;
    }
};

},
"domain/expressions/parser.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseExpression = parseExpression;
const math_functions_1 = require("./math-functions");
function parseExpression(tokens, resolve) {
    let tokenIndex = 0;
    const peekValue = () => tokens[tokenIndex] && tokens[tokenIndex].value;
    const consume = (value) => {
        if (peekValue() === value) {
            tokenIndex++;
            return true;
        }
        return false;
    };
    const expect = (value) => {
        if (!consume(value))
            throw new Error(`Expected '${value}' in formula.`);
    };
    const finiteNumber = (number) => {
        if (typeof number !== 'number' || !Number.isFinite(number))
            throw new Error('Formula returned a non-finite number.');
        return number;
    };
    function readFunction(name) {
        if (!Object.prototype.hasOwnProperty.call(math_functions_1.MATH_FUNCTIONS, name))
            throw new Error(`Unsupported function: ${name}`);
        const functionArguments = [];
        if (!consume(')')) {
            do {
                functionArguments.push(readSum());
            } while (consume(','));
            expect(')');
        }
        return finiteNumber(math_functions_1.MATH_FUNCTIONS[name](...functionArguments));
    }
    function readPrimary() {
        if (consume('+'))
            return readPrimary();
        if (consume('-'))
            return -readPrimary();
        if (consume('(')) {
            const result = readSum();
            expect(')');
            return result;
        }
        const token = tokens[tokenIndex++];
        if (!token)
            throw new Error('Incomplete formula.');
        if (token.kind === 'number')
            return Number(token.value);
        if (token.kind === 'id') {
            if (consume('('))
                return readFunction(token.value);
            return finiteNumber(resolve(token.value));
        }
        throw new Error(`Unexpected token: ${token.value}`);
    }
    function readProduct() {
        let result = readPrimary();
        while (['*', '/', '%'].includes(peekValue())) {
            const operator = tokens[tokenIndex++].value;
            const rightOperand = readPrimary();
            if (operator === '*')
                result *= rightOperand;
            else if (operator === '/')
                result /= rightOperand;
            else
                result %= rightOperand;
            result = finiteNumber(result);
        }
        return result;
    }
    function readSum() {
        let result = readProduct();
        while (['+', '-'].includes(peekValue())) {
            const operator = tokens[tokenIndex++].value;
            const rightOperand = readProduct();
            result = finiteNumber(operator === '+' ? result + rightOperand : result - rightOperand);
        }
        return result;
    }
    if (!tokens.length)
        throw new Error('Empty formula.');
    const result = readSum();
    if (tokenIndex !== tokens.length)
        throw new Error(`Unexpected token: ${tokens[tokenIndex].value}`);
    return finiteNumber(result);
}

},
"domain/expressions/tokenizer.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenizeExpression = tokenizeExpression;
function tokenizeExpression(source) {
    if (typeof source !== 'string' || source.length > 1500)
        throw new Error('Expression is empty or too long.');
    const tokens = [];
    const tokenPattern = /\s*(?:(\d+(?:\.\d+)?)|([a-z][a-z0-9_]*)|([+\-*/%(),]))/gy;
    let position = 0;
    while (position < source.length) {
        tokenPattern.lastIndex = position;
        const found = tokenPattern.exec(source);
        if (!found) {
            if (!source.slice(position).trim())
                break;
            throw new Error(`Unexpected character in formula near: ${source.slice(position, position + 20)}`);
        }
        const [, number, identifier, symbol] = found;
        let kind = 'symbol';
        if (number)
            kind = 'number';
        else if (identifier)
            kind = 'id';
        tokens.push({ kind, value: number || identifier || symbol });
        position = tokenPattern.lastIndex;
        if (tokens.length > 400)
            throw new Error('Formula exceeds the token limit.');
    }
    return tokens;
}

},
"domain/format-options.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCALES = void 0;
exports.availableCurrencies = availableCurrencies;
exports.availableLocales = availableLocales;
exports.previewFormat = previewFormat;
exports.recommendedCurrency = recommendedCurrency;
const formatting_options_data_1 = require("./formatting-options-data");
Object.defineProperty(exports, "LOCALES", { enumerable: true, get: function () { return formatting_options_data_1.LOCALES; } });
function recommendedCurrency(locale) {
    const region = String(locale)
        .split('-')
        .find(part => /^[A-Za-z]{2}$/.test(part) && part.toUpperCase() === part);
    return formatting_options_data_1.REGION_CURRENCIES[region || ''] || null;
}
function currencyCodes() {
    let available;
    try {
        available = Intl.supportedValuesOf('currency');
    }
    catch (_) {
        available = formatting_options_data_1.FALLBACK_CURRENCIES;
    }
    const currencies = new Set([...available, ...formatting_options_data_1.FALLBACK_CURRENCIES]);
    return [
        ...formatting_options_data_1.POPULAR_CURRENCIES.filter(code => currencies.has(code)),
        ...[...currencies].filter(code => !formatting_options_data_1.POPULAR_CURRENCIES.includes(code)).sort()
    ];
}
function currencyLabel(code) {
    try {
        const names = new Intl.DisplayNames(['en'], {
            type: 'currency'
        });
        const name = names.of(code);
        if (name && name !== code)
            return `${name} (${code})`;
    }
    catch (_) { }
    return code;
}
function availableLocales(current) {
    const options = formatting_options_data_1.LOCALES.slice();
    if (current && !options.some(([tag]) => tag === current))
        options.push([current, `${current} (existing value)`]);
    return options;
}
function availableCurrencies(current) {
    const codes = currencyCodes();
    if (current && !codes.includes(current))
        codes.push(current);
    return codes.map(code => [code, currencyLabel(code)]);
}
function previewFormat(locale, currency, amount = 1234.56) {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency
    }).format(amount);
}

},
"domain/formatting-options-data.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGION_CURRENCIES = exports.FALLBACK_CURRENCIES = exports.POPULAR_CURRENCIES = exports.LOCALES = void 0;
const LOCALES = [
    ['ar-AE', 'Arabic (United Arab Emirates)'],
    ['ar-SA', 'Arabic (Saudi Arabia)'],
    ['de-DE', 'German (Germany)'],
    ['en-AU', 'English (Australia)'],
    ['en-CA', 'English (Canada)'],
    ['en-GB', 'English (United Kingdom)'],
    ['en-IN', 'English (India)'],
    ['en-US', 'English (United States)'],
    ['es-AR', 'Spanish (Argentina)'],
    ['es-CL', 'Spanish (Chile)'],
    ['es-CO', 'Spanish (Colombia)'],
    ['es-ES', 'Spanish (Spain)'],
    ['es-MX', 'Spanish (Mexico)'],
    ['fr-CA', 'French (Canada)'],
    ['fr-FR', 'French (France)'],
    ['hi-IN', 'Hindi (India)'],
    ['it-IT', 'Italian (Italy)'],
    ['ja-JP', 'Japanese (Japan)'],
    ['ko-KR', 'Korean (South Korea)'],
    ['nl-NL', 'Dutch (Netherlands)'],
    ['pl-PL', 'Polish (Poland)'],
    ['pt-BR', 'Portuguese (Brazil)'],
    ['pt-PT', 'Portuguese (Portugal)'],
    ['ru-RU', 'Russian (Russia)'],
    ['sv-SE', 'Swedish (Sweden)'],
    ['tr-TR', 'Turkish (Türkiye)'],
    ['zh-CN', 'Chinese (China)'],
    ['zh-TW', 'Chinese (Taiwan)']
];
exports.LOCALES = LOCALES;
const POPULAR_CURRENCIES = [
    'USD',
    'EUR',
    'BRL',
    'GBP',
    'CAD',
    'AUD',
    'JPY',
    'CHF',
    'MXN',
    'ARS',
    'CLP',
    'COP',
    'INR',
    'CNY',
    'KRW',
    'AED',
    'SAR'
];
exports.POPULAR_CURRENCIES = POPULAR_CURRENCIES;
const FALLBACK_CURRENCIES = [
    ...POPULAR_CURRENCIES,
    'PEN',
    'UYU',
    'PYG',
    'BOB',
    'TRY',
    'RUB',
    'SEK',
    'NOK',
    'DKK',
    'PLN',
    'ZAR',
    'NZD',
    'SGD',
    'HKD',
    'TWD'
];
exports.FALLBACK_CURRENCIES = FALLBACK_CURRENCIES;
const REGION_CURRENCIES = {
    AE: 'AED',
    AR: 'ARS',
    AU: 'AUD',
    BR: 'BRL',
    CA: 'CAD',
    CH: 'CHF',
    CL: 'CLP',
    CN: 'CNY',
    CO: 'COP',
    DE: 'EUR',
    ES: 'EUR',
    FR: 'EUR',
    GB: 'GBP',
    IN: 'INR',
    IT: 'EUR',
    JP: 'JPY',
    KR: 'KRW',
    MX: 'MXN',
    NL: 'EUR',
    PL: 'PLN',
    PT: 'EUR',
    RU: 'RUB',
    SA: 'SAR',
    SE: 'SEK',
    TR: 'TRY',
    TW: 'TWD',
    US: 'USD'
};
exports.REGION_CURRENCIES = REGION_CURRENCIES;

},
"domain/template-formatting.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeText = escapeText;
exports.duration = duration;
exports.createValueFormatter = createValueFormatter;
function escapeText(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\|/g, '&#124;')
        .replace(/\r?\n/g, ' ');
}
function duration(months, long, locale) {
    if (!Number.isFinite(months) || months < 0) {
        throw new Error('Duration must be a non-negative finite number.');
    }
    const totalMonths = Math.ceil(months);
    const words = /^pt/i.test(locale)
        ? { month: 'mês', months: 'meses', year: 'ano', years: 'anos', and: 'e' }
        : { month: 'month', months: 'months', year: 'year', years: 'years', and: 'and' };
    const monthLabel = (count) => `${count} ${count === 1 ? words.month : words.months}`;
    const short = monthLabel(totalMonths);
    if (!long || totalMonths < 12)
        return short;
    const years = Math.floor(totalMonths / 12);
    const remainingMonths = totalMonths % 12;
    const yearLabel = `${years} ${years === 1 ? words.year : words.years}`;
    const remainder = remainingMonths ? ` ${words.and} ${monthLabel(remainingMonths)}` : '';
    return `${short} (${yearLabel}${remainder})`;
}
function createValueFormatter(source) {
    const numberFormat = new Intl.NumberFormat(source.locale, { maximumFractionDigits: 2 });
    const moneyFormat = new Intl.NumberFormat(source.locale, {
        style: 'currency',
        currency: source.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return (kind, key, value) => {
        if (kind === 'text')
            return escapeText(value);
        if (kind === 'boolean') {
            if (typeof value !== 'boolean')
                throw new Error(`${key} must be boolean.`);
            return String(value);
        }
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw new Error(`Field '${key}' must be numeric for ${kind}.`);
        }
        switch (kind) {
            case 'money':
                return escapeText(moneyFormat.format(value));
            case 'number':
                return escapeText(numberFormat.format(value));
            case 'decimal':
                return escapeText(new Intl.NumberFormat(source.locale, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(value));
            case 'integer':
                if (!Number.isInteger(value))
                    throw new Error(`${key} must be an integer.`);
                return String(value);
            default:
                return escapeText(duration(value, kind === 'duration_long', source.locale));
        }
    };
}

},
"domain/template-renderer.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeText = exports.duration = void 0;
exports.renderTemplate = renderTemplate;
const data_model_1 = require("./data-model");
const template_formatting_1 = require("./template-formatting");
var template_formatting_2 = require("./template-formatting");
Object.defineProperty(exports, "duration", { enumerable: true, get: function () { return template_formatting_2.duration; } });
Object.defineProperty(exports, "escapeText", { enumerable: true, get: function () { return template_formatting_2.escapeText; } });
const CLASS_BY_TONE = {
    income: 'nts-income',
    expense: 'nts-expense',
    investment: 'nts-investment',
    pending: 'nts-pending',
    success: 'nts-success'
};
const PLACEHOLDER_PATTERN = /\{\{\s*(text|number|decimal|integer|money|duration|duration_long|boolean):([a-z][a-z0-9_]*)(?::(income|expense|investment|pending|auto))?\s*\}\}/g;
function applyTone(output, tone, value) {
    if (!tone)
        return output;
    let resolvedTone = tone;
    if (tone === 'auto')
        resolvedTone = typeof value === 'number' && value >= 0 ? 'income' : 'expense';
    if (tone === 'pending')
        resolvedTone = typeof value === 'number' && value > 0 ? 'pending' : 'success';
    return `<span class="${CLASS_BY_TONE[resolvedTone]}">${output}</span>`;
}
function renderTemplate(template, source) {
    const values = (0, data_model_1.validateData)(source);
    const formatValue = (0, template_formatting_1.createValueFormatter)(source);
    const rendered = template.replace(PLACEHOLDER_PATTERN, (_token, kind, key, tone) => {
        if (!Object.prototype.hasOwnProperty.call(values, key))
            throw new Error(`Unknown template field '${key}'.`);
        const value = values[key];
        return applyTone(formatValue(kind, key, value), tone, value);
    });
    if (/\{\{[\s\S]*?\}\}/.test(rendered))
        throw new Error('Template contains an unsupported or malformed placeholder.');
    return rendered;
}

},
"features/connections/connection-fields.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConnectionFields = createConnectionFields;
const obsidian_1 = require("obsidian");
const data_path_1 = require("../../application/connections/data-path");
const picker_modal_1 = require("../../infrastructure/obsidian/ui/picker-modal");
function createConnectionFields(options) {
    const { app, connection, existing, rerender, onDataSourceChange } = options;
    let useExistingData = false;
    return (root) => {
        new obsidian_1.Setting(root)
            .setName('Connection name')
            .setDesc('Label shown in the editor; does not rename files.')
            .addText(input => input.setValue(connection.title).onChange(value => {
            connection.title = value;
        }));
        new obsidian_1.Setting(root)
            .setName('Data storage')
            .setDesc('The plugin manages a portable JSON file. Existing connections keep their original data paths.')
            .addButton(button => button.setButtonText(useExistingData ? 'Use managed storage' : 'Use existing JSON (advanced)').onClick(() => {
            useExistingData = !useExistingData;
            if (!useExistingData && !existing)
                connection.data_path = (0, data_path_1.managedDataPath)(connection.id);
            void rerender();
        }));
        if (useExistingData) {
            const dataRow = new obsidian_1.Setting(root)
                .setName('Existing JSON file')
                .setDesc('Choose a portable data source already in your vault.');
            dataRow.addText(text => text
                .setPlaceholder('folder/my-data.json')
                .setValue(connection.data_path)
                .onChange(value => {
                connection.data_path = value;
            }));
            dataRow.addExtraButton(button => button
                .setIcon('folder-open')
                .setTooltip('Choose existing JSON')
                .onClick(() => (0, picker_modal_1.createFilePicker)(app, 'json', path => {
                connection.data_path = path;
                onDataSourceChange();
                void rerender();
            }).open()));
        }
        const documentFiles = [
            { key: 'template_path', label: 'Template (.md)', placeholder: 'any_folder/my_template.md' },
            { key: 'output_path', label: 'Generated note (.md)', placeholder: 'any_folder/my_report.md' }
        ];
        for (const { key, label, placeholder } of documentFiles) {
            const row = new obsidian_1.Setting(root).setName(label);
            row.addText(text => {
                text
                    .setPlaceholder(placeholder)
                    .setValue(connection[key])
                    .onChange(value => {
                    connection[key] = value;
                });
            });
            row.addExtraButton(button => button
                .setIcon('folder-open')
                .setTooltip('Choose an existing file')
                .onClick(() => (0, picker_modal_1.createFilePicker)(app, 'md', path => {
                connection[key] = path;
                void rerender();
            }).open()));
        }
    };
}

},
"features/connections/connection-modal.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConnectionModal = createConnectionModal;
const obsidian_1 = require("obsidian");
const connection_paths_1 = require("../../application/connections/connection-paths");
const data_path_1 = require("../../application/connections/data-path");
const confirm_modal_1 = require("../../infrastructure/obsidian/ui/confirm-modal");
const message_1 = require("../../infrastructure/obsidian/ui/message");
const error_message_1 = require("../../shared/error-message");
const identifier_1 = require("../../shared/identifier");
const connection_fields_1 = require("./connection-fields");
const connection_regional_settings_1 = require("./connection-regional-settings");
function createConnectionModal(app, actions, existing = null) {
    const modal = new obsidian_1.Modal(app);
    const id = existing?.id ?? (0, identifier_1.randomId)();
    const connection = existing
        ? {
            ...existing
        }
        : {
            id,
            title: 'New connection',
            data_path: (0, data_path_1.managedDataPath)(id),
            template_path: '',
            output_path: '',
            enabled: true
        };
    const regionalSettings = (0, connection_regional_settings_1.createRegionalSettings)(app, actions.readFormats);
    const renderFields = (0, connection_fields_1.createConnectionFields)({
        app,
        connection,
        existing,
        rerender: render,
        onDataSourceChange: regionalSettings.reset
    });
    async function render() {
        await regionalSettings.load(connection.data_path);
        const root = modal.contentEl;
        root.empty();
        root.addClass('nts-connection-modal');
        modal.titleEl.setText(existing ? 'Edit connection' : 'Create connection');
        (0, message_1.message)(root, 'Select a template and output note. Your data is stored automatically as portable JSON in your vault.');
        renderFields(root);
        regionalSettings.render(root);
        new obsidian_1.Setting(root).setName('Automatic updates').addToggle(toggle => toggle.setValue(connection.enabled).onChange(value => {
            connection.enabled = value;
        }));
        new obsidian_1.Setting(root)
            .addButton(button => button.setButtonText('Cancel').onClick(() => modal.close()))
            .addButton(button => button
            .setButtonText(existing ? 'Save connection' : 'Create connection')
            .setCta()
            .onClick(submit));
    }
    async function submit() {
        try {
            (0, connection_paths_1.validateConnection)(connection);
            if (!connection.title.trim())
                throw new Error('Connection name is required.');
            actions.validateConnection(connection);
            regionalSettings.validate();
        }
        catch (error) {
            new obsidian_1.Notice((0, error_message_1.errorMessage)(error));
            return;
        }
        const isExistingOutput = app.vault.getAbstractFileByPath(connection.output_path) instanceof obsidian_1.TFile;
        const needsConfirmation = isExistingOutput && (!existing || existing.output_path !== connection.output_path);
        if (needsConfirmation) {
            const description = `The existing file '${connection.output_path}' will be overwritten when you generate the document. Make a backup first.`;
            const confirmation = (0, confirm_modal_1.createConfirmModal)(app, 'Replace generated note?', description, 'Replace', () => save(true));
            confirmation.open();
        }
        else {
            await save();
        }
    }
    async function save(overwriteApproved = false) {
        try {
            await actions.saveConnection(connection, {
                create: !existing,
                format: regionalSettings.getDraft(),
                overwriteApproved
            });
            modal.close();
            new obsidian_1.Notice('Connection saved.');
        }
        catch (error) {
            new obsidian_1.Notice(`Could not save connection: ${(0, error_message_1.errorMessage)(error)}`, 8000);
        }
    }
    modal.onOpen = render;
    modal.onClose = () => modal.contentEl.empty();
    return modal;
}

},
"features/connections/connection-regional-settings.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRegionalSettings = createRegionalSettings;
const obsidian_1 = require("obsidian");
const format_options_1 = require("../../domain/format-options");
const message_1 = require("../../infrastructure/obsidian/ui/message");
const picker_modal_1 = require("../../infrastructure/obsidian/ui/picker-modal");
function createRegionalSettings(app, readFormats) {
    const state = {
        formatDraft: null,
        currencyTouched: false,
        localeDropdown: null,
        currencyDropdown: null,
        previewEl: null
    };
    function getFormats() {
        return (state.formatDraft ??= { locale: 'en-US', currency: 'USD' });
    }
    function render(root) {
        root.createEl('h3', {
            text: 'Regional settings',
            cls: 'nts-settings-heading'
        });
        (0, message_1.message)(root, 'These settings are saved in the source JSON, keeping your data portable.');
        renderLocale(root);
        renderCurrency(root);
        const preview = root.createDiv({
            cls: 'nts-format-preview'
        });
        preview.createEl('span', {
            text: 'Formatting preview',
            cls: 'nts-preview-label'
        });
        state.previewEl = preview.createEl('strong');
        refreshPreview();
    }
    function renderLocale(root) {
        const localeSetting = new obsidian_1.Setting(root).setName('Locale').setDesc('Language and region used to format numbers.');
        localeSetting.addDropdown(dropdown => {
            state.localeDropdown = dropdown;
            for (const [value, label] of (0, format_options_1.availableLocales)(getFormats().locale))
                dropdown.addOption(value, `${label} — ${value}`);
            dropdown.setValue(getFormats().locale).onChange(changeLocale);
        });
        localeSetting.addExtraButton(button => button
            .setIcon('search')
            .setTooltip('Search locales')
            .onClick(() => (0, picker_modal_1.createOptionPicker)(app, 'Search locale', (0, format_options_1.availableLocales)(getFormats().locale).map(([tag, label]) => [tag, `${label} — ${tag}`]), value => {
            state.localeDropdown?.setValue(value);
            changeLocale(value);
        }).open()));
    }
    function renderCurrency(root) {
        const currencySetting = new obsidian_1.Setting(root).setName('Currency').setDesc('ISO 4217 code used for currency values.');
        currencySetting.addDropdown(dropdown => {
            state.currencyDropdown = dropdown;
            for (const [value, label] of (0, format_options_1.availableCurrencies)(getFormats().currency))
                dropdown.addOption(value, label);
            dropdown.setValue(getFormats().currency).onChange(changeCurrency);
        });
        currencySetting.addExtraButton(button => button
            .setIcon('search')
            .setTooltip('Search currencies')
            .onClick(() => (0, picker_modal_1.createOptionPicker)(app, 'Search currency name or code', (0, format_options_1.availableCurrencies)(getFormats().currency), value => {
            state.currencyDropdown?.setValue(value);
            changeCurrency(value);
        }).open()));
    }
    function changeLocale(value) {
        const formats = getFormats();
        const previousCurrency = (0, format_options_1.recommendedCurrency)(formats.locale);
        formats.locale = value;
        const suggestion = (0, format_options_1.recommendedCurrency)(value);
        if (!state.currencyTouched && suggestion && formats.currency === previousCurrency) {
            formats.currency = suggestion;
            state.currencyDropdown?.setValue(suggestion);
        }
        refreshPreview();
    }
    function changeCurrency(value) {
        state.currencyTouched = true;
        getFormats().currency = value;
        refreshPreview();
    }
    function refreshPreview() {
        if (!state.previewEl)
            return;
        try {
            state.previewEl.setText((0, format_options_1.previewFormat)(getFormats().locale, getFormats().currency));
        }
        catch (_) {
            state.previewEl.setText('Invalid locale or currency');
        }
    }
    return {
        render,
        getDraft: () => state.formatDraft,
        async load(path) {
            state.formatDraft ??= await readFormats(path);
        },
        reset() {
            state.formatDraft = null;
        },
        validate() {
            const { locale, currency } = getFormats();
            (0, format_options_1.previewFormat)(locale, currency);
        }
    };
}

},
"features/connections/settings-tab.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderConnectionSettings = renderConnectionSettings;
const obsidian_1 = require("obsidian");
const confirm_modal_1 = require("../../infrastructure/obsidian/ui/confirm-modal");
const connection_modal_1 = require("./connection-modal");
function renderConnectionSettings(root, app, actions) {
    root.empty();
    renderHeader();
    for (const connection of actions.listConnections()) {
        renderConnectionRow(connection);
    }
    root.createEl('p', {
        text: 'The generated note can be overwritten. Keep manual edits in the template, not the generated note.',
        cls: 'setting-item-description'
    });
    function renderHeader() {
        new obsidian_1.Setting(root)
            .setName('Document connections')
            .setDesc('Each connection links portable JSON data, a Markdown template, and an output note. No fixed folder or file names.')
            .addButton(button => button.setButtonText('Add connection').setCta().onClick(addConnection));
    }
    function addConnection() {
        (0, connection_modal_1.createConnectionModal)(app, actions).open();
    }
    function renderConnectionRow(connection) {
        const row = new obsidian_1.Setting(root)
            .setName(connection.title)
            .setDesc(`${connection.data_path} → ${connection.output_path}`);
        row.addToggle(control => control.setValue(connection.enabled).onChange(setAutomaticSync));
        row.addExtraButton(button => button.setIcon('pencil').setTooltip('Edit connection').onClick(editConnection));
        row.addExtraButton(button => button.setIcon('trash').setTooltip('Remove connection (files are not deleted)').onClick(confirmRemoval));
        async function setAutomaticSync(enabled) {
            await actions.saveConnection({ ...connection, enabled });
        }
        function editConnection() {
            (0, connection_modal_1.createConnectionModal)(app, actions, connection).open();
        }
        function confirmRemoval() {
            const description = `Remove '${connection.title}'? The data, template and output files will be kept.`;
            (0, confirm_modal_1.createConfirmModal)(app, 'Remove connection?', description, 'Remove', removeConnection).open();
        }
        async function removeConnection() {
            await actions.removeConnection(connection.id);
            renderConnectionSettings(root, app, actions);
        }
    }
}

},
"features/data-editor/calculated-fields.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCalculatedFields = createCalculatedFields;
const obsidian_1 = require("obsidian");
const field_modal_1 = require("./field-modal");
function createCalculatedFields(options) {
    const { app, actions, onDelete } = options;
    function render(page, connection, document, calculated) {
        const formulaGroup = page.createEl('details', {
            cls: 'nts-group'
        });
        formulaGroup.open = true;
        formulaGroup.createEl('summary', {
            text: 'Calculated fields',
            cls: 'nts-section'
        });
        const formulaCards = formulaGroup.createDiv({
            cls: 'nts-field-grid'
        });
        if (!document.formulas.length)
            formulaCards.createEl('p', {
                text: 'Add a formula to derive values from other fields.',
                cls: 'setting-item-description'
            });
        for (const item of document.formulas) {
            const row = new obsidian_1.Setting(formulaCards).setName(item.label);
            row.settingEl.addClass('nts-field', 'nts-formula');
            row.settingEl.dataset.formulaKey = item.key;
            row.nameEl?.setAttribute('title', `${item.key} = ${item.expression}`);
            row.addText(control => {
                control.setValue(String(calculated[item.key])).setDisabled(true);
                control.inputEl.setAttribute('aria-label', `Calculated: ${item.label}`);
            });
            row.addExtraButton(button => button
                .setIcon('pencil')
                .setTooltip('Edit formula')
                .onClick(() => (0, field_modal_1.createFieldModal)(app, actions, {
                connectionId: connection.id,
                kind: 'formula',
                field: item
            }).open()));
            row.addExtraButton(button => button
                .setIcon('trash')
                .setTooltip('Delete formula')
                .onClick(() => onDelete(connection.id, item.key)));
        }
        new obsidian_1.Setting(formulaGroup).addButton(button => button
            .setButtonText('Add calculated field')
            .onClick(() => (0, field_modal_1.createFieldModal)(app, actions, { connectionId: connection.id, kind: 'formula' }).open()));
    }
    return render;
}

},
"features/data-editor/editable-fields.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEditableFields = createEditableFields;
const obsidian_1 = require("obsidian");
const error_message_1 = require("../../shared/error-message");
const field_modal_1 = require("./field-modal");
function addValueControl(row, field, saveValue) {
    if (field.type === 'boolean') {
        row.addToggle(control => control.setValue(field.value === true).onChange(saveValue));
    }
    else {
        row.addText(control => {
            control.setPlaceholder(field.type === 'number' ? '0.00' : 'Value').setValue(String(field.value));
            control.inputEl.setAttribute('aria-label', field.label);
            if (field.type === 'number') {
                control.inputEl.type = 'number';
                control.inputEl.step = 'any';
            }
            if (field.type === 'date')
                control.inputEl.type = 'date';
            control.inputEl.addEventListener('change', () => {
                const raw = control.getValue();
                if (field.type === 'number' && (raw.trim() === '' || !Number.isFinite(Number(raw)))) {
                    new obsidian_1.Notice('Enter a valid number.');
                    control.setValue(String(field.value));
                    return;
                }
                void saveValue(field.type === 'number' ? Number(raw) : raw);
            });
        });
    }
}
function filterFieldGroups(page, search) {
    for (const group of Array.from(page.querySelectorAll('.nts-group'))) {
        let visible = 0;
        for (const item of Array.from(group.querySelectorAll('.nts-searchable'))) {
            const matched = (item.dataset.search || '').includes(search);
            item.hidden = !matched;
            if (matched)
                visible++;
        }
        group.hidden = visible === 0;
        if (search && visible)
            group.open = true;
    }
}
function createEditableFields(options) {
    const { app, actions, onValueSaved, onSaveFailed, onDelete } = options;
    function render(page, connection, document) {
        const searchInput = page.createEl('input', {
            type: 'search',
            placeholder: 'Search fields by name or key...',
            cls: 'nts-search'
        });
        searchInput.setAttribute('aria-label', 'Search fields');
        const grouped = new Map();
        for (const field of document.fields) {
            const section = field.section || 'General';
            const fields = grouped.get(section) || [];
            fields.push(field);
            grouped.set(section, fields);
        }
        for (const [section, fields] of grouped) {
            const group = page.createEl('details', {
                cls: 'nts-group'
            });
            group.open = true;
            group.createEl('summary', {
                text: section,
                cls: 'nts-section'
            });
            const cards = group.createDiv({
                cls: 'nts-field-grid'
            });
            for (const field of fields)
                renderField(cards, connection.id, field);
        }
        searchInput.addEventListener('input', () => {
            filterFieldGroups(page, searchInput.value.toLocaleLowerCase().trim());
        });
        new obsidian_1.Setting(page).addButton(button => button
            .setButtonText('Add field')
            .onClick(() => (0, field_modal_1.createFieldModal)(app, actions, { connectionId: connection.id, kind: 'field' }).open()));
    }
    function renderField(cards, connectionId, field) {
        const row = new obsidian_1.Setting(cards).setName(field.label);
        row.settingEl.addClass('nts-field', 'nts-searchable');
        row.settingEl.dataset.search = `${field.label} ${field.key}`.toLocaleLowerCase();
        row.nameEl?.setAttribute('title', field.key);
        const commit = async (value) => {
            try {
                await actions.updateValue(connectionId, field.key, value);
                await onValueSaved(connectionId);
            }
            catch (err) {
                new obsidian_1.Notice(`Could not save: ${(0, error_message_1.errorMessage)(err)}`, 8000);
                await onSaveFailed();
            }
        };
        addValueControl(row, field, commit);
        row.addExtraButton(button => button
            .setIcon('pencil')
            .setTooltip('Edit field')
            .onClick(() => (0, field_modal_1.createFieldModal)(app, actions, { connectionId, kind: 'field', field }).open()));
        row.addExtraButton(button => button
            .setIcon('trash')
            .setTooltip('Delete field')
            .onClick(() => onDelete(connectionId, field.key)));
    }
    return render;
}

},
"features/data-editor/editor-dialogs.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEditorDialogs = createEditorDialogs;
const obsidian_1 = require("obsidian");
const confirm_modal_1 = require("../../infrastructure/obsidian/ui/confirm-modal");
const error_message_1 = require("../../shared/error-message");
function createEditorDialogs(app, actions, onDeleted) {
    function confirmOverwrite(connection) {
        (0, confirm_modal_1.createConfirmModal)(app, 'Overwrite modified report?', `The generated note '${connection.output_path}' may contain manual changes. Overwrite them with the template output?`, 'Overwrite', async () => {
            await actions.syncConnection(connection.id, { notify: true, overwriteApproved: true });
        }).open();
    }
    function askDelete(connectionId, key, isFormula) {
        (0, confirm_modal_1.createConfirmModal)(app, 'Remove field?', `Removing '${key}' may break formulas or template placeholders that reference it. The previous generated report will be kept if rendering fails.`, 'Delete', async () => {
            try {
                await actions.deleteField(connectionId, { key, kind: isFormula ? 'formula' : 'field' });
                await onDeleted();
            }
            catch (err) {
                new obsidian_1.Notice((0, error_message_1.errorMessage)(err), 8000);
            }
        }).open();
    }
    return { confirmOverwrite, askDelete };
}

},
"features/data-editor/editor-navigation.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEditorNavigation = createEditorNavigation;
const obsidian_1 = require("obsidian");
const connection_modal_1 = require("../connections/connection-modal");
function createEditorNavigation(options) {
    const { app, actions, close, selectConnection, syncConnection } = options;
    function renderHeading(page) {
        const top = page.createDiv({
            cls: 'nts-heading'
        });
        const intro = top.createDiv({
            cls: 'nts-intro'
        });
        intro.createEl('h2', {
            text: 'Data editor'
        });
        intro.createEl('p', {
            text: 'Edit values and preview your report alongside.'
        });
        const headingActions = top.createDiv({
            cls: 'nts-heading-actions'
        });
        new obsidian_1.Setting(headingActions)
            .addButton(button => button
            .setButtonText('New connection')
            .setCta()
            .onClick(() => (0, connection_modal_1.createConnectionModal)(app, actions).open()))
            .addExtraButton(button => button
            .setIcon('x')
            .setTooltip('Close data editor')
            .onClick(() => close()));
    }
    function renderToolbar(page, connection) {
        let syncButton;
        const toolbar = page.createDiv({
            cls: 'nts-toolbar'
        });
        new obsidian_1.Setting(toolbar)
            .setName('Connection')
            .addDropdown(dropdown => {
            for (const item of actions.listConnections())
                dropdown.addOption(item.id, item.title);
            dropdown.setValue(connection.id).onChange(async (id) => {
                await selectConnection(id);
            });
        })
            .addExtraButton(button => button
            .setIcon('settings')
            .setTooltip('Edit connection')
            .onClick(() => (0, connection_modal_1.createConnectionModal)(app, actions, connection).open()))
            .addExtraButton(button => {
            syncButton = button
                .setIcon('refresh-cw')
                .setTooltip('Checking for changes\u2026')
                .setDisabled(true)
                .onClick(() => syncConnection(connection));
        });
        const reportActions = page.createDiv({
            cls: 'nts-report-actions'
        });
        const syncStatusEl = reportActions.createEl('span', {
            cls: 'nts-sync-status',
            text: 'Checking report…'
        });
        new obsidian_1.Setting(reportActions).addButton(button => button.setButtonText('Open report').onClick(async () => {
            const file = app.vault.getAbstractFileByPath(connection.output_path);
            if (file instanceof obsidian_1.TFile)
                await app.workspace.getLeaf('tab').openFile(file);
            else
                new obsidian_1.Notice('Generate the document first.');
        }));
        return { syncButton, syncStatusEl };
    }
    return { renderHeading, renderToolbar };
}

},
"features/data-editor/editor-view.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEditorController = createEditorController;
const data_model_1 = require("../../domain/data-model");
const error_message_1 = require("../../shared/error-message");
const calculated_fields_1 = require("./calculated-fields");
const editable_fields_1 = require("./editable-fields");
const editor_dialogs_1 = require("./editor-dialogs");
const editor_navigation_1 = require("./editor-navigation");
const sync_controls_1 = require("./sync-controls");
function createEditorController(host, actions) {
    const state = {
        connectionId: null,
        syncButton: null,
        syncStatusEl: null,
        renderVersion: 0,
        disposed: false
    };
    const syncControls = (0, sync_controls_1.createSyncControls)({
        inspect: actions.inspectConnection,
        isAutomatic: id => actions.listConnections().find(connection => connection.id === id)?.enabled ?? false
    });
    const dialogs = (0, editor_dialogs_1.createEditorDialogs)(host.app, actions, render);
    const navigation = (0, editor_navigation_1.createEditorNavigation)({
        app: host.app,
        actions,
        close: () => host.leaf.detach(),
        async selectConnection(id) {
            state.connectionId = id;
            await render();
        },
        async syncConnection(connection) {
            if (!state.syncButton || !syncControls.canSync())
                return;
            syncControls.invalidate();
            state.syncButton.setDisabled(true);
            if (syncControls.result() === 'conflict')
                dialogs.confirmOverwrite(connection);
            else
                await actions.syncConnection(connection.id, { notify: true });
            await refreshSyncStatus();
        }
    });
    const renderEditableFields = (0, editable_fields_1.createEditableFields)({
        app: host.app,
        actions,
        onValueSaved: refreshCalculatedValues,
        onSaveFailed: render,
        onDelete: (id, key) => dialogs.askDelete(id, key, false)
    });
    const renderCalculatedFields = (0, calculated_fields_1.createCalculatedFields)({
        app: host.app,
        actions,
        onDelete: (id, key) => dialogs.askDelete(id, key, true)
    });
    async function render() {
        if (state.disposed)
            return;
        const version = ++state.renderVersion;
        const root = host.contentEl;
        root.empty();
        root.addClass('nts-editor');
        state.syncButton = null;
        state.syncStatusEl = null;
        syncControls.invalidate();
        const page = root.createDiv({
            cls: 'nts-page'
        });
        navigation.renderHeading(page);
        const connections = actions.listConnections();
        if (!connections.length) {
            page.createEl('p', {
                text: 'Connect a JSON data file, a Markdown template, and an output note to begin.',
                cls: 'nts-help'
            });
            return;
        }
        const connection = connections.find(item => item.id === state.connectionId) ?? connections[0];
        state.connectionId = connection.id;
        const controls = navigation.renderToolbar(page, connection);
        state.syncButton = controls.syncButton;
        state.syncStatusEl = controls.syncStatusEl;
        let document;
        let calculated;
        try {
            document = (await actions.readSource(connection.id)).data;
            if (version !== state.renderVersion || state.disposed)
                return;
            calculated = (0, data_model_1.validateData)(document);
        }
        catch (err) {
            page.createEl('p', {
                text: `Could not read data: ${(0, error_message_1.errorMessage)(err)}`,
                cls: 'nts-warning'
            });
            await refreshSyncStatus();
            return;
        }
        renderEditableFields(page, connection, document);
        renderCalculatedFields(page, connection, document, calculated);
        page.createEl('p', {
            text: connection.enabled
                ? 'Values are saved when you finish editing. Automatic updates keep your report current.'
                : 'Values are saved when you finish editing. Use Sync when you are ready to update the report.',
            cls: 'nts-help'
        });
        await refreshSyncStatus();
    }
    async function refreshSyncStatus() {
        if (state.syncButton && state.syncStatusEl && state.connectionId) {
            await syncControls.refresh(state.connectionId, state.syncButton, state.syncStatusEl);
        }
    }
    async function refreshCalculatedValues(connectionId) {
        const { data } = await actions.readSource(connectionId);
        const values = (0, data_model_1.validateData)(data);
        const root = host.contentEl;
        for (const card of Array.from(root.querySelectorAll('.nts-formula'))) {
            const input = card.querySelector('input');
            const key = card.dataset.formulaKey;
            if (input && key !== undefined && Object.prototype.hasOwnProperty.call(values, key))
                input.value = String(values[key]);
        }
        await refreshSyncStatus();
    }
    return {
        render,
        refreshSyncStatus,
        getConnectionId: () => state.connectionId,
        dispose() {
            state.disposed = true;
            syncControls.dispose();
            state.renderVersion++;
        }
    };
}

},
"features/data-editor/field-modal.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFieldModal = createFieldModal;
const obsidian_1 = require("obsidian");
const data_model_1 = require("../../domain/data-model");
const error_message_1 = require("../../shared/error-message");
function createFieldModal(app, actions, options) {
    const modal = new obsidian_1.Modal(app);
    const field = options.field;
    const isFormula = options.kind === 'formula';
    const draft = createDraft();
    function createDraft() {
        if (field) {
            return { ...field };
        }
        if (isFormula) {
            return {
                key: '',
                label: '',
                expression: '',
                tone: 'none'
            };
        }
        return {
            key: '',
            label: '',
            section: 'General',
            type: 'number',
            tone: 'none',
            value: 0
        };
    }
    function render() {
        modal.titleEl.setText(`${field ? 'Edit' : 'Add'} ${isFormula ? 'calculated field' : 'field'}`);
        new obsidian_1.Setting(modal.contentEl).setName('Key (snake_case)').addText(control => control
            .setValue(draft.key)
            .setDisabled(Boolean(field))
            .onChange(value => {
            draft.key = value.trim();
        }));
        new obsidian_1.Setting(modal.contentEl).setName('Label').addText(control => control.setValue(draft.label).onChange(value => {
            draft.label = value;
        }));
        if (isFormula) {
            if (!('expression' in draft))
                throw new Error('A calculated field requires an expression.');
            new obsidian_1.Setting(modal.contentEl)
                .setName('Formula')
                .setDesc('Arithmetic, keys, and sum/min/max/round/ceil/floor/abs. No JavaScript.')
                .addTextArea(control => control.setValue(draft.expression).onChange(value => {
                draft.expression = value;
            }));
        }
        else {
            if (!('type' in draft))
                throw new Error('A data field requires a type.');
            new obsidian_1.Setting(modal.contentEl).setName('Section').addText(control => control.setValue(draft.section).onChange(value => {
                draft.section = value;
            }));
            new obsidian_1.Setting(modal.contentEl).setName('Type').addDropdown(dropdown => {
                ['number', 'text', 'date', 'boolean'].forEach(item => dropdown.addOption(item, item));
                dropdown
                    .setValue(draft.type)
                    .setDisabled(Boolean(field))
                    .onChange(value => {
                    if ((0, data_model_1.isFieldType)(value)) {
                        draft.type = value;
                        draft.value = value === 'number' ? 0 : value === 'boolean' ? false : '';
                    }
                });
            });
        }
        if (!field && !isFormula && 'type' in draft)
            new obsidian_1.Setting(modal.contentEl).setName('Initial value').addText(control => control.setValue(String(draft.value)).onChange(value => {
                draft.value = draft.type === 'number' ? Number(value) : draft.type === 'boolean' ? value === 'true' : value;
            }));
        new obsidian_1.Setting(modal.contentEl).setName('Color role').addDropdown(dropdown => {
            ['none', 'income', 'expense', 'investment', 'pending', 'auto'].forEach(item => dropdown.addOption(item, item));
            dropdown.setValue(draft.tone || 'none').onChange(value => {
                if ((0, data_model_1.isColorRole)(value))
                    draft.tone = value;
            });
        });
        new obsidian_1.Setting(modal.contentEl)
            .addButton(button => button.setButtonText('Cancel').onClick(() => modal.close()))
            .addButton(button => button
            .setButtonText('Save')
            .setCta()
            .onClick(async () => {
            try {
                (0, data_model_1.checkKey)(draft.key);
                if (!draft.label.trim())
                    throw new Error('Label is required.');
                const mode = field ? 'edit' : 'create';
                if (isFormula && 'expression' in draft)
                    await actions.saveField(options.connectionId, { kind: 'formula', entity: draft, mode });
                else if ('type' in draft)
                    await actions.saveField(options.connectionId, { kind: 'field', entity: draft, mode });
                modal.close();
            }
            catch (err) {
                new obsidian_1.Notice((0, error_message_1.errorMessage)(err), 8000);
            }
        }));
    }
    modal.onOpen = render;
    modal.onClose = () => modal.contentEl.empty();
    return modal;
}

},
"features/data-editor/sync-controls.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSyncControls = createSyncControls;
const sync_policy_1 = require("../../application/synchronization/sync-policy");
const error_message_1 = require("../../shared/error-message");
function createSyncControls(options) {
    let version = 0;
    let disposed = false;
    let canSync = false;
    let result = null;
    function invalidate() {
        version++;
        canSync = false;
    }
    async function refresh(id, button, label) {
        if (disposed)
            return;
        const check = ++version;
        canSync = false;
        button.setDisabled(true);
        try {
            const status = await options.inspect(id);
            if (disposed || check !== version)
                return;
            const controls = (0, sync_policy_1.deriveSyncControls)(status, options.isAutomatic(id));
            result = status;
            canSync = controls.canManualSync;
            button.setDisabled(!canSync);
            button.setTooltip(controls.status === 'conflict'
                ? 'Review and confirm overwrite'
                : canSync
                    ? 'Sync pending changes'
                    : controls.status === 'automatic'
                        ? 'Updating automatically'
                        : 'Report is up to date');
            label.setText(controls.label);
            label.toggleClass('nts-sync-pending', controls.status === 'pending' || controls.status === 'conflict');
        }
        catch (error) {
            if (disposed || check !== version)
                return;
            button.setDisabled(true);
            button.setTooltip('Resolve the error before syncing');
            label.setText(`Cannot sync: ${(0, error_message_1.errorMessage)(error)}`);
            label.removeClass('nts-sync-pending');
        }
    }
    return {
        refresh,
        invalidate,
        canSync: () => canSync,
        result: () => result,
        dispose() {
            disposed = true;
            invalidate();
        }
    };
}

},
"infrastructure/obsidian/data-editor-view.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VIEW_TYPE = void 0;
exports.createDataEditorView = createDataEditorView;
const obsidian_1 = require("obsidian");
const editor_view_1 = require("../../features/data-editor/editor-view");
exports.VIEW_TYPE = 'note-template-sync-editor';
function createDataEditorView(leaf, actions) {
    return new (class extends obsidian_1.ItemView {
        editor = (0, editor_view_1.createEditorController)(this, actions);
        getViewType() {
            return exports.VIEW_TYPE;
        }
        getDisplayText() {
            return 'Data editor';
        }
        getIcon() {
            return 'sliders-horizontal';
        }
        async onOpen() {
            await this.editor.render();
        }
        async onClose() {
            this.editor.dispose();
        }
    })(leaf);
}

},
"infrastructure/obsidian/editor-workspace.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEditorWorkspace = createEditorWorkspace;
const obsidian_1 = require("obsidian");
const data_editor_view_1 = require("./data-editor-view");
function createEditorWorkspace(app) {
    const views = () => app.workspace.getLeavesOfType(data_editor_view_1.VIEW_TYPE).map(leaf => leaf.view);
    async function open() {
        const existing = app.workspace.getLeavesOfType(data_editor_view_1.VIEW_TYPE)[0];
        if (existing) {
            await app.workspace.revealLeaf(existing);
            return;
        }
        const leaf = app.workspace.getRightLeaf(false);
        if (!leaf) {
            new obsidian_1.Notice('Could not open the right sidebar.');
            return;
        }
        await leaf.setViewState({ type: data_editor_view_1.VIEW_TYPE, active: true });
        await app.workspace.revealLeaf(leaf);
    }
    function close() {
        app.workspace.detachLeavesOfType(data_editor_view_1.VIEW_TYPE);
    }
    async function toggle() {
        if (views().length)
            close();
        else
            await open();
    }
    async function refresh() {
        for (const view of views())
            await view.editor.render();
    }
    async function refreshSync(id) {
        for (const view of views())
            if (view.editor.getConnectionId() === id)
                await view.editor.refreshSyncStatus();
    }
    return {
        open,
        close,
        toggle,
        refresh,
        refreshSync
    };
}

},
"infrastructure/obsidian/plugin-entry.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
const plugin_actions_1 = require("../../application/plugin-actions");
const editor_workspace_1 = require("./editor-workspace");
const plugin_lifecycle_1 = require("./plugin-lifecycle");
class TemplateSyncPlugin extends obsidian_1.Plugin {
    actions;
    editor;
    dispose;
    async onload() {
        this.editor = (0, editor_workspace_1.createEditorWorkspace)(this.app);
        this.actions = (0, plugin_actions_1.createPluginActions)({
            vault: this.app.vault,
            savedSettings: await this.loadData(),
            saveSettings: settings => this.saveData(settings),
            notify: (message, duration) => {
                new obsidian_1.Notice(message, duration);
            },
            refreshEditors: this.editor.refresh,
            refreshSync: this.editor.refreshSync
        });
        this.dispose = (0, plugin_lifecycle_1.registerPlugin)(this, this.actions, this.editor);
    }
    onunload() {
        this.dispose?.();
    }
}
exports.default = TemplateSyncPlugin;

},
"infrastructure/obsidian/plugin-lifecycle.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPlugin = registerPlugin;
const obsidian_1 = require("obsidian");
const connection_modal_1 = require("../../features/connections/connection-modal");
const settings_tab_1 = require("../../features/connections/settings-tab");
const data_editor_view_1 = require("./data-editor-view");
function registerPlugin(plugin, actions, editor) {
    const { app } = plugin;
    let disposed = false;
    plugin.registerView(data_editor_view_1.VIEW_TYPE, leaf => (0, data_editor_view_1.createDataEditorView)(leaf, actions));
    plugin.addRibbonIcon('sliders-horizontal', 'Toggle data editor', editor.toggle);
    plugin.addCommand({ id: 'open-data-editor', name: 'Open data editor', callback: editor.open });
    plugin.addCommand({
        id: 'create-document-connection',
        name: 'Create document connection',
        callback: () => (0, connection_modal_1.createConnectionModal)(app, actions).open()
    });
    plugin.addCommand({
        id: 'regenerate-all',
        name: 'Regenerate all documents',
        callback: async () => {
            for (const connection of actions.listConnections())
                await actions.syncConnection(connection.id, { notify: true });
        }
    });
    plugin.addSettingTab(new (class extends obsidian_1.PluginSettingTab {
        display() {
            (0, settings_tab_1.renderConnectionSettings)(this.containerEl, app, actions);
        }
    })(app, plugin));
    app.workspace.onLayoutReady(() => {
        if (disposed)
            return;
        if (app.workspace.getLeavesOfType(data_editor_view_1.VIEW_TYPE).length) {
            editor.close();
            void editor.open();
        }
        for (const connection of actions.listConnections())
            if (connection.enabled)
                actions.queueSync(connection.id);
    });
    plugin.registerEvent(app.vault.on('modify', file => {
        for (const connection of actions.listConnections()) {
            if (file.path === connection.data_path || file.path === connection.template_path) {
                void editor.refreshSync(connection.id);
                actions.queueSync(connection.id);
            }
            else if (file.path === connection.output_path) {
                void editor.refreshSync(connection.id);
            }
        }
    }));
    plugin.registerEvent(app.vault.on('rename', async (file, oldPath) => {
        if (await actions.relocateConnections(oldPath, file.path))
            await editor.refresh();
    }));
    plugin.registerEvent(app.vault.on('delete', file => {
        for (const connection of actions.listConnections()) {
            if ([connection.data_path, connection.template_path, connection.output_path].some(path => path === file.path || path.startsWith(file.path + '/'))) {
                new obsidian_1.Notice(`Note Template Sync: a connected file or folder was removed: ${file.path}`, 7000);
            }
        }
    }));
    return () => {
        disposed = true;
        actions.dispose();
        editor.close();
    };
}

},
"infrastructure/obsidian/ui/confirm-modal.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConfirmModal = createConfirmModal;
const obsidian_1 = require("obsidian");
const error_message_1 = require("../../../shared/error-message");
function createConfirmModal(app, title, description, confirmText, action) {
    const modal = new obsidian_1.Modal(app);
    modal.onOpen = () => {
        modal.titleEl.setText(title);
        modal.contentEl.createEl('p', {
            text: description,
            cls: 'setting-item-description'
        });
        new obsidian_1.Setting(modal.contentEl)
            .addButton(button => button.setButtonText('Cancel').onClick(() => modal.close()))
            .addButton(button => {
            button.setButtonText(confirmText);
            if (typeof button.setDestructive === 'function') {
                button.setDestructive().setCta();
            }
            else {
                button.buttonEl.addClass('mod-warning');
            }
            button.onClick(async () => {
                modal.close();
                try {
                    await action();
                }
                catch (error) {
                    new obsidian_1.Notice((0, error_message_1.errorMessage)(error), 8000);
                }
            });
        });
    };
    modal.onClose = () => modal.contentEl.empty();
    return modal;
}

},
"infrastructure/obsidian/ui/message.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.message = message;
function message(container, text) {
    container.createEl('p', { text, cls: 'setting-item-description' });
}

},
"infrastructure/obsidian/ui/picker-modal.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFilePicker = createFilePicker;
exports.createOptionPicker = createOptionPicker;
const obsidian_1 = require("obsidian");
function createPicker(app, placeholder, items, label, choose) {
    const modal = new (class extends obsidian_1.FuzzySuggestModal {
        getItems() {
            return items();
        }
        getItemText(item) {
            return label(item);
        }
        onChooseItem(item) {
            choose(item);
        }
    })(app);
    modal.setPlaceholder(placeholder);
    return modal;
}
function createFilePicker(app, extension, choose) {
    const placeholder = `Choose ${extension} file`;
    function getMatchingFiles() {
        const files = app.vault.getFiles();
        return files.filter(file => file.extension.toLowerCase() === extension);
    }
    function getFilePath(file) {
        return file.path;
    }
    function handleFileSelection(file) {
        choose(file.path);
    }
    return createPicker(app, placeholder, getMatchingFiles, getFilePath, handleFileSelection);
}
function createOptionPicker(app, placeholder, options, choose) {
    return createPicker(app, placeholder, () => options, item => item[1], item => choose(item[0]));
}

},
"main.js": function(module, exports, require) {
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = void 0;
var plugin_entry_1 = require("./infrastructure/obsidian/plugin-entry");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return __importDefault(plugin_entry_1).default; } });

},
"shared/error-message.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMessage = errorMessage;
const value_guards_1 = require("./value-guards");
function errorMessage(error) {
    if (typeof error === 'string')
        return error;
    if ((0, value_guards_1.isRecord)(error) && typeof error.message === 'string')
        return error.message;
    return 'Unknown error.';
}

},
"shared/identifier.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomId = randomId;
function randomId() {
    return 'doc_' + Math.random().toString(36).slice(2, 11);
}

},
"shared/path-utils.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePath = normalizePath;
exports.relocatePath = relocatePath;
function normalizePath(input) {
    if (typeof input !== 'string')
        throw new Error('File path is required.');
    const path = input.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
    if (!path || path.startsWith('/') || path.endsWith('/')) {
        throw new Error('Use a file path relative to your vault.');
    }
    if (path.split('/').some(part => part === '.' || part === '..' || !part)) {
        throw new Error('Path traversal is not allowed.');
    }
    if (path.split('/')[0] === '.obsidian') {
        throw new Error('Do not store document files in the .obsidian configuration folder.');
    }
    return path;
}
function relocatePath(path, oldPath, newPath) {
    if (path === oldPath)
        return newPath;
    if (path.startsWith(oldPath + '/'))
        return newPath + path.slice(oldPath.length);
    return path;
}

},
"shared/value-guards.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRecord = isRecord;
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

}
});

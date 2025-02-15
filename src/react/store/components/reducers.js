import { actions } from './actions';
import * as helpers from './helpers';
import { arrayUtils } from '../../utils';


export default function reducer (state = {
	compatibleComponentsLoaded: false,
	installedComponentsLoaded: false,
	errorLoading: false,
	error: '',
	isEditing: false,
	showInfoModal: false,

	// TODO currentCoreVersion ? selectedCoreVersion? targetCoreVersion?
	coreVersion: null,
	coreDesc: '',

	// current content of the info modal
	infoModal: '', // { type: 'module' | theme | api | core, folder: '' }

	// populated when a user clicks the About link for a component. This always contains the latest + greatest
	// data for a component - it's not affected by anything else in the UI
	changelogs: {},

	// compatible components grouped by core version. The installation script only ever needs the list of
	// compatible components for the Core version being installed, but for the Update page within Form Tools
	// need to get both the current + soon-to-be-upgraded-to core version compatibility list to ensure nothing gets
	// borked when they upgrade
	compatibleComponents: {},

	// the currently installed component details
	installedCore: {},
	installedAPI: {},
	installedModules: {},
	installedThemes: {},

	// the selected components. These depend on the actual compatibleComponents for the core version
	selectedComponentTypeSections: [], // 'core', 'api', 'module', 'theme'
	selectedModuleFolders: [],
	selectedThemeFolders: [],
	apiSelected: false,
	coreSelected: false,

	// download status data
	isDownloading: false,
	downloadComplete: false,
	showDetailedDownloadLog: false,

	// populated the moment the user proceeds to the download step. This is a 1-level deep object of property names:
	// api, theme_[theme folder], module_[module folder] with each value containing an object of
	// { downloadSuccess: null|false|true, log: [] }
	downloadedComponents: {},

	// any time the user clicks "Customize" we stash the last config here, in case they cancel their changes and
	// want to revert
	lastSavedComponents: {}

}, action) {

	const payload = action.payload;
	switch (action.type) {

		// converts the list of modules and themes to an object with (unique) folder names as keys
		case actions.COMPATIBLE_COMPONENTS_LOADED:

			const modules = {};
			payload.modules.forEach(({ name, desc, folder, repo, version }) => {
				modules[folder] = {
					name, desc, folder, repo,
					version: version.version,
					type: 'module'
				};
			});

			const themes = {};
			payload.themes.forEach(({ name, desc, folder, repo, version }) => {
				themes[folder] = {
					name, desc, folder, repo,
					version: version.version,
					type: 'theme'
				};
			});

			let api = {};
			if (payload.api.length) {
				api = {
					name: 'API',
					folder: 'api',
					type: 'api',
					desc: payload.api[0].desc,
					version: payload.api[0].version,
					release_date: payload.api[0].release_date
				};
			}

			return Object.assign({}, state, {
				compatibleComponentsLoaded: true,
				compatibleComponents: {
					...state.compatibleComponents,
					[payload.coreVersion]: {
						modules,
						themes,
						api
					}
				}
			});

		case actions.INIT_SELECTED_COMPONENTS:
			return {
				...state,
				//selectedComponentTypeSections: payload.selectedComponentTypeSections,
				coreSelected: payload.coreSelected,
				apiSelected: payload.apiSelected,
				selectedModuleFolders: payload.selectedModuleFolders,
				selectedThemeFolders: payload.selectedThemeFolders
			};


		case actions.SET_CORE_VERSION:
			return {
				...state,
				coreVersion: payload.coreVersion
			};

		case actions.INSTALLED_COMPONENTS_LOADED:
			return {
				...state,
				installedComponentsLoaded: true,
				installedCore: payload.components.core,
				installedAPI: payload.components.api,
				installedModules: payload.components.modules,
				installedThemes: payload.components.themes
			};

		case actions.TOGGLE_API:
			return {
				...state,
				apiSelected: !state.apiSelected
			};

		case actions.TOGGLE_MODULE:
			return {
				...state,
				selectedModuleFolders: selectedComponentsReducer(state.selectedModuleFolders, action.folder)
			};

		case actions.TOGGLE_THEME:
			return {
				...state,
				selectedThemeFolders: selectedComponentsReducer(state.selectedThemeFolders, action.folder)
			};

		case actions.SELECT_ALL_MODULES:
			const moduleList = state.compatibleComponents[state.coreVersion].modules;
			return {
				...state,
				selectedModuleFolders: arrayUtils.convertHashToArray(moduleList).map((module) => module.folder)
			};

		case actions.DESELECT_ALL_MODULES:
			return {
				...state,
				selectedModuleFolders: []
			};

		case actions.EDIT_SELECTED_COMPONENT_LIST:
			return {
				...state,
				isEditing: true,
				lastSavedComponents: {
					selectedModuleFolders: state.selectedModuleFolders,
					selectedThemeFolders: state.selectedThemeFolders,
					apiSelected: state.apiSelected
				}
			};

		case actions.CANCEL_EDIT_SELECTED_COMPONENT_LIST:
			return {
				...state,
				isEditing: false,
				selectedModuleFolders: state.lastSavedComponents.selectedModuleFolders,
				selectedThemeFolders: state.lastSavedComponents.selectedThemeFolders,
				apiSelected: state.lastSavedComponents.apiSelected
			};

		case actions.START_DOWNLOAD_COMPATIBLE_COMPONENTS:
			return {
				...state,
				isDownloading: true,
				downloadedComponents: action.payload.componentList
			};

		case actions.COMPONENT_DOWNLOAD_UNPACK_RESPONSE:
			const downloadedComponents = { ...state.downloadedComponents };
			const componentId = helpers.getComponentIdentifier(action.payload.folder, action.payload.type);
			downloadedComponents[componentId].downloadSuccess = action.payload.success;
			downloadedComponents[componentId].log = action.payload.log;

			// if all components are downloaded, flag the downloaded process as complete
			let allDownloaded = Object.keys(downloadedComponents).every((component) => {
				return downloadedComponents[component].downloadSuccess !== null;
			});

			// TODO need to add another flag here asking if the whole process was success or not

			return {
				...state,
				downloadedComponents,
				isDownloading: !allDownloaded,
				downloadComplete: allDownloaded
			};

		case actions.SAVE_SELECTED_COMPONENT_LIST:
			return {
				...state,
				isEditing: false
			};

		// selects a single component type section, overwriting any previous: used for the installation script where
		// you can only select a single section at once
		case actions.SELECT_COMPONENT_TYPE_SECTION:
			return {
				...state,
				selectedComponentTypeSections: [payload.section]
			};

		case actions.SELECT_COMPONENT_TYPE_SECTIONS:
			return {
				...state,
				selectedComponentTypeSections: payload.sections
			};

		case actions.TOGGLE_COMPONENT_TYPE_SECTION:
			let updatedSections = [...state.selectedComponentTypeSections];
			if (updatedSections.indexOf(payload.section) === -1) {
				updatedSections.push(payload.section);
			} else {
				updatedSections = updatedSections.filter((item) => item !== payload.section);
			}
			return {
				...state,
				selectedComponentTypeSections: updatedSections
			};

		case actions.SHOW_COMPONENT_CHANGELOG_MODAL:
			return {
				...state,
				showInfoModal: true,
				infoModal: {
					componentType: action.payload.componentType,
					folder: action.payload.folder
				}
			};

		case actions.CLOSE_COMPONENT_CHANGELOG_MODAL:
			return {
				...state,
				showInfoModal: false
			};

		case actions.COMPONENT_HISTORY_LOADED:
			const updatedChangelogs = { ...state.changelogs };
			updatedChangelogs[payload.folder] = {
				loadSuccess: payload.loadSuccess,
				versions: payload.versions
			};

			const newState = {
				...state,
				changelogs: updatedChangelogs
			};

			// the Core and API descriptions
			if (action.payload.folder === 'core') {
				newState.coreDesc = payload.desc;
			}

			return newState;

		case actions.TOGGLE_SHOW_DETAILED_DOWNLOAD_LOG:
			return {
				...state,
				showDetailedDownloadLog: !state.showDetailedDownloadLog
			};
	}

	return state;
};

const selectedComponentsReducer = (state = [], folder) => {
	if (state.includes(folder)) {
		return arrayUtils.removeFromArray(state, folder);
	} else {
		return [...state, folder];
	}
};

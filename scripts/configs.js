export const PROD_ENV = 'prod';
export const PPROD_ENV = 'pprod';
export const EDS_ENV = 'aem';
export const STAGE_ENV = 'stage';
export const DEV_ENV = 'dev';
export const PREVIEW_ENV = 'preview';
const ALLOWED_CONFIGS = [PROD_ENV, PPROD_ENV, EDS_ENV, DEV_ENV, PREVIEW_ENV];
const SEPARATE_CONFIG_FILES = [STAGE_ENV, PREVIEW_ENV, PPROD_ENV];
// store configs globally to avoid multiple requests
window.configsPromises = {};

/*
 * Returns the true origin of the current page in the browser.
 * If the page is running in a iframe with srcdoc, the ancestor origin is returned.
 * @returns {String} The true origin
 */
function getOrigin() {
  const { location } = window;
  return location.href === 'about:srcdoc' ? window.parent.location.origin : location.origin;
}

function getHref() {
  if (window.location.href !== 'about:srcdoc') return window.location.href;

  const { location: parentLocation } = window.parent;
  const urlParams = new URLSearchParams(parentLocation.search);
  return `${parentLocation.origin}${urlParams.get('path')}`;
}

export function getLanguageAttr() {
  const path = getHref();
  if (path.includes('/ar/')) {
    return 'ar';
  }
  return document.documentElement.lang || 'en';
}
/**
 * This function calculates the environment in which the site is running based on the URL.
 * It defaults to 'prod'. In non 'prod' environments, the value can be overwritten using
 * the 'environment' key in sessionStorage.
 *
 * @returns {string} - environment identifier (dev, stage or prod'.
 */
export const calcEnvironment = () => {
  const { href } = window.location;
  let environment = PROD_ENV;
  if (href.includes('.hlx.page') || href.includes('.aem.page')) {
    environment = EDS_ENV;
  } else if (href.includes('-stage.factory.alshayauat.com')) {
    environment = STAGE_ENV;
  } else if (href.includes('localhost')) {
    environment = DEV_ENV;
  } else if (href.includes('-eds.factory.alshayauat.com')) {
    environment = PREVIEW_ENV;
  } else if (href.includes('-pprod.factory.alshayauat.com')) {
    environment = PPROD_ENV;
  }

  const environmentFromConfig = window.sessionStorage.getItem('environment');
  if (environmentFromConfig
    && ALLOWED_CONFIGS.includes(environmentFromConfig)
    && environment !== PROD_ENV) {
    return environmentFromConfig;
  }

  return environment;
};

function buildConfigURL(env, locale) {
  const origin = getOrigin();
  const localePath = locale ? `${locale}/` : '';
  let configFileName = 'configs.json';
  if (SEPARATE_CONFIG_FILES.includes(env)) {
    configFileName = `configs-${env}.json`;
  }
  // const configURL = new URL(`${origin}/${localePath}${configFileName}`);
  const configURL = new URL(`https://main--edstraining--sigkumar.aem.live/draft/hemanth/en/configs.json`);
  return configURL;
}

const getStoredConfig = (env, locale) => {
  const configKey = locale ? `config:${locale}` : 'config';

  return window.sessionStorage.getItem(configKey);
};

const storeConfig = (configJSON, env, locale) => {
  const configKey = locale ? `config:${locale}` : 'config';

  return window.sessionStorage.setItem(configKey, configJSON);
};

const getConfig = async () => {
  const language = getLanguageAttr();
  const env = calcEnvironment();
  let configJSON = getStoredConfig(env);
  let configLocaleJSON = getStoredConfig(env, language);

  if (!configJSON || !configLocaleJSON) {
    const fetchGlobalConfig = fetch(buildConfigURL(env));
    const fetchLocalConfig = fetch(buildConfigURL(env, language));
    try {
      const responses = await Promise.all([fetchGlobalConfig, fetchLocalConfig]);

      // Extract JSON data from responses
      [configJSON, configLocaleJSON] = await Promise.all(responses
        .map((response) => response.text()));

      storeConfig(configJSON, env);
      storeConfig(configLocaleJSON, env, language);
    } catch (e) {
      console.error('no config loaded', e);
    }
  }

  // merge config and locale config
  const config = JSON.parse(configJSON);

  if (configLocaleJSON) {
    const configLocale = JSON.parse(configLocaleJSON);
    configLocale.data.forEach((localeConfig) => {
      const existing = config.data.find((c) => c.key === localeConfig.key);
      if (existing) {
        existing.value = localeConfig.value;
      } else {
        config.data.push(localeConfig);
      }
    });
  }

  return config;
};

/**
 * This function retrieves a configuration value for a given environment.
 *
 * @param {string} configParam - The configuration parameter to retrieve.
 * @returns {Promise<string|undefined>} - The value of the configuration parameter, or undefined.
 */
export const getConfigValue = async (configParam) => {
  const env = PROD_ENV;
  if (!window.configsPromises?.[env]) {
    window.configsPromises[env] = getConfig(env);
  }

  const configJSON = await window.configsPromises[env];
  const configElements = configJSON.data;
  return configElements.find((c) => c.key === configParam)?.value;
};

/**
 * This function retrieves all configuration values for a given environment.
 *
 * @returns {Promise<Object>} - All configuration values
 */
export const getAllConfigs = async () => {
  const env = 'prod';
  if (!window.configsPromises?.[env]) {
    window.configsPromises[env] = getConfig(env);
  }
  const configs = {};
  const configJSON = await window.configsPromises[env];
  configJSON.data?.forEach((config) => {
    configs[config.key] = config.value;
  });

  return configs;
};

export const formatDate = (dateString) => {
  const language = getLanguageAttr();
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleString(language, { month: 'short' });
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
};

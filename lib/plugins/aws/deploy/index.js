'use strict';

const BbPromise = require('bluebird');
const validate = require('../lib/validate');
const monitorStack = require('../lib/monitorStack');
const createStack = require('./lib/createStack');
const mergeCustomProviderResources = require('./lib/mergeCustomProviderResources');
const generateArtifactDirectoryName = require('./lib/generateArtifactDirectoryName');
const setBucketName = require('../lib/setBucketName');
const cleanupS3Bucket = require('./lib/cleanupS3Bucket');
const uploadArtifacts = require('./lib/uploadArtifacts');
const updateStack = require('../lib/updateStack');
const configureStack = require('./lib/configureStack');
const mergeIamTemplates = require('./lib/mergeIamTemplates');

class AwsDeploy {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('aws');

    Object.assign(
      this,
      validate,
      createStack,
      generateArtifactDirectoryName,
      mergeCustomProviderResources,
      setBucketName,
      cleanupS3Bucket,
      uploadArtifacts,
      updateStack,
      monitorStack,
      configureStack,
      mergeIamTemplates
    );

    this.commands = {
      awsDeploy: {
        // We declare the uppermost command as entrypoint because the AWSDeploy
        // plugin does not expose any CLI commands.
        type: 'entrypoint',
        commands: {
          build: {
            lifecycleEvents: [
              'prepare',
            ],
          },
          deploy: {
            lifecycleEvents: [
              'prepare',
              'uploadArtifacts',
              'updateStack',
              'cleanup',
            ],
          },
        },
      },
    };

    this.hooks = {
      'before:deploy:initialize': () => BbPromise.bind(this)
        .then(this.validate),

      'deploy:initialize': () => BbPromise.bind(this)
        .then(this.configureStack),

      'deploy:setupProviderConfiguration': () => BbPromise.bind(this)
        .then(this.createStack)
        .then(this.mergeIamTemplates),

      'before:deploy:compileFunctions': () => BbPromise.bind(this)
        .then(this.generateArtifactDirectoryName),

      // The deploy spawns the internal build and deploy lifecycle
      'deploy:deploy': () => this.serverless.pluginManager.spawn(['awsDeploy', 'build'])
        .then(() => this.serverless.pluginManager.spawn(['awsDeploy', 'deploy']))
        .then(() => {
          if (this.options.noDeploy) this.serverless.cli.log('Did not deploy due to --noDeploy');
        }),

      'awsDeploy:build:prepare': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.mergeCustomProviderResources),

      'awsDeploy:deploy:prepare': () => BbPromise.bind(this)
        .then(this.validate),

      'awsDeploy:deploy:uploadArtifacts': () => BbPromise.bind(this)
        .then(this.setBucketName)
        .then(this.uploadArtifacts),

      'awsDeploy:deploy:updateStack': () => BbPromise.bind(this)
        .then(this.updateStack),

      'awsDeploy:deploy:cleanup': () => BbPromise.bind(this)
        .then(this.cleanupS3Bucket),

    };
  }
}

module.exports = AwsDeploy;

pipeline {
  agent any

  options {
    timestamps()
  }

  tools {
    nodejs 'Node 18'
  }

  environment {
    SONAR_PROJECT_KEY = 'algo-arena-backend'
    SONAR_PROJECT_NAME = 'AlgoArena Backend'
    DOCKER_IMAGE_NAME = 'algo-arena-backend'
    DOCKER_REGISTRY = 'docker.io'
    DOCKER_CREDENTIALS_ID = 'dockerhub-creds'
    CD_JOB_NAME = 'AlgoArena-CD'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install dependencies') {
      steps {
        sh 'npm ci'
      }
    }

    stage('Test and coverage') {
      steps {
        sh 'npm run test:cov -- --runInBand'
      }
    }

    stage('Build') {
      steps {
        sh 'npm run build'
      }
    }

    stage('SonarQube analysis') {
      steps {
        script {
          def scannerHome = tool 'SonarScanner'
          withSonarQubeEnv('SonarQube') {
            sh "${scannerHome}/bin/sonar-scanner -Dsonar.projectKey=${SONAR_PROJECT_KEY} -Dsonar.projectName=${SONAR_PROJECT_NAME} -Dsonar.sources=src -Dsonar.tests=src,test -Dsonar.test.inclusions=src/**/*.spec.ts,test/**/*.e2e-spec.ts -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info"
          }
        }
      }
    }

    stage('Quality Gate') {
      steps {
        timeout(time: 10, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: true
        }
      }
    }

    stage('Docker build and push') {
      steps {
        script {
          def imageTag = "${env.DOCKER_REGISTRY}/${env.DOCKER_IMAGE_NAME}:${env.BUILD_NUMBER}"

          docker.withRegistry("https://${env.DOCKER_REGISTRY}", env.DOCKER_CREDENTIALS_ID) {
            def image = docker.build(imageTag)
            image.push()
            image.push('latest')
          }
        }
      }
    }

    stage('Trigger CD') {
      steps {
        build job: env.CD_JOB_NAME, wait: false, parameters: [
          string(name: 'IMAGE_TAG', value: "${env.DOCKER_REGISTRY}/${env.DOCKER_IMAGE_NAME}:${env.BUILD_NUMBER}"),
          string(name: 'IMAGE_LATEST', value: "${env.DOCKER_REGISTRY}/${env.DOCKER_IMAGE_NAME}:latest")
        ]
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'coverage/**', allowEmptyArchive: false
    }
  }
}
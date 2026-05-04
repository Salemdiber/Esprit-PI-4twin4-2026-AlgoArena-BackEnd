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
    SONAR_COVERAGE_EXCLUSIONS = 'src/**/*.controller.ts,src/**/*.module.ts,src/**/*.dto.ts,src/**/*.schema.ts,src/**/*.enum.ts,src/**/*.guard.ts,src/**/decorators/**,src/**/templates/**,src/main.ts,src/app.module.ts,src/challenge-import-samples/**,src/ai/**,src/ai-agents/**,src/analytics/**,src/chat/**,src/billing/**,src/onboarding/**,src/sessions/**,src/support/**,src/system-health/**,src/settings/**,src/cache/**'
    DOCKER_IMAGE_NAME = 'salemdiber/algo-arena-backend'
    DOCKER_REGISTRY = 'docker.io'
    DOCKER_CREDENTIALS_ID = 'dockerhub-creds'
    CD_JOB_NAME = 'AlgoArena-Back-CD'
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
            sh "${scannerHome}/bin/sonar-scanner -Dsonar.projectKey=${SONAR_PROJECT_KEY} -Dsonar.projectName=\"${SONAR_PROJECT_NAME}\" -Dsonar.sources=src -Dsonar.tests=src,test -Dsonar.test.inclusions=src/**/*.spec.ts,test/**/*.e2e-spec.ts -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info -Dsonar.coverage.exclusions=${SONAR_COVERAGE_EXCLUSIONS}"
          }
        }
      }
    }

    stage('Quality Gate') {
      steps {
        catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
          timeout(time: 3, unit: 'MINUTES') {
            waitForQualityGate abortPipeline: false
          }
        }
      }
    }

    stage('Docker build and push') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          sh '''
          echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin
          
          docker build -t docker.io/salemdiber/algo-arena-backend:$BUILD_NUMBER .
          docker tag docker.io/salemdiber/algo-arena-backend:$BUILD_NUMBER docker.io/salemdiber/algo-arena-backend:latest
          
          docker push docker.io/salemdiber/algo-arena-backend:$BUILD_NUMBER
          docker push docker.io/salemdiber/algo-arena-backend:latest
          '''
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

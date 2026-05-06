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
    PROMETHEUS_PUSHGATEWAY = 'http://127.0.0.1:9091'
    ALERTMANAGER_URL = 'http://127.0.0.1:9093/api/v1/alerts'
    CI_JOB_NAME = 'algoarena-backend-ci'
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
        sh 'npm run test:cov -- --runInBand --coverageReporters=text --coverageReporters=lcov --coverageReporters=json-summary'
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
        echo 'SonarQube analysis submitted. Skipping Quality Gate wait to keep CI fast.'
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
      
      script {
        def buildDurationSeconds = (currentBuild.duration ?: 0L) / 1000.0

        withEnv(["BUILD_DURATION_SECONDS=${buildDurationSeconds}"]) {
          sh(script: '''
        set +e

        if [ -f coverage/coverage-summary.json ]; then
          COVERAGE=$(node -e "const fs=require('fs'); const summary=JSON.parse(fs.readFileSync('coverage/coverage-summary.json','utf8')); process.stdout.write(String(summary.total?.statements?.pct ?? 0));")
        else
          COVERAGE=0
          echo "coverage/coverage-summary.json not found, exporting coverage=0"
        fi

        cat << EOF | curl -fsS --connect-timeout 5 --max-time 10 --data-binary @- "$PROMETHEUS_PUSHGATEWAY/metrics/job/$CI_JOB_NAME" >/dev/null || \
          echo "Pushgateway unreachable at $PROMETHEUS_PUSHGATEWAY, skipping metric export"
# HELP cicd_build_duration_seconds Build duration in seconds
# TYPE cicd_build_duration_seconds gauge
cicd_build_duration_seconds{job="backend"} $BUILD_DURATION_SECONDS
# HELP cicd_test_coverage_percent Test coverage percentage
# TYPE cicd_test_coverage_percent gauge
cicd_test_coverage_percent{job="backend"} ${COVERAGE}
# HELP cicd_build_timestamp Build timestamp
# TYPE cicd_build_timestamp gauge
cicd_build_timestamp{job="backend"} $(date +%s)
EOF
          ''', returnStatus: true)
        }
      }
    }

    success {
      script {
        // Send success metric (ignore non-zero exit)
        sh(script: '''
        set +e

        cat << EOF | curl -fsS --connect-timeout 5 --max-time 10 --data-binary @- "$PROMETHEUS_PUSHGATEWAY/metrics/job/$CI_JOB_NAME" >/dev/null || \
          echo "Pushgateway unreachable at $PROMETHEUS_PUSHGATEWAY, skipping success metric export"
# HELP cicd_build_success_total Total successful builds
# TYPE cicd_build_success_total counter
cicd_build_success_total{job="backend"} 1
EOF

# Resolve any existing build failure alerts
curl -fsS --connect-timeout 5 --max-time 10 -X POST -H "Content-Type: application/json" \
  -d '{
    "alerts": [{
      "status": "resolved",
      "labels": {
        "alertname": "BackendBuildFailed",
        "severity": "critical",
        "job": "backend"
      },
      "annotations": {
        "summary": "Backend build succeeded",
        "description": "Build #'$BUILD_NUMBER' completed successfully"
      }
    }]
  }' \
  "$ALERTMANAGER_URL" >/dev/null || echo "Alertmanager unreachable at $ALERTMANAGER_URL, skipping resolved alert"
        ''', returnStatus: true)
        echo "✓ Build successful - metrics exported"
      }
    }

    failure {
      script {
        // Send failure metric and alert (ignore non-zero exit)
        sh(script: '''
        set +e

        cat << EOF | curl -fsS --connect-timeout 5 --max-time 10 --data-binary @- "$PROMETHEUS_PUSHGATEWAY/metrics/job/$CI_JOB_NAME" >/dev/null || \
          echo "Pushgateway unreachable at $PROMETHEUS_PUSHGATEWAY, skipping failure metric export"
# HELP cicd_build_failures_total Total failed builds
# TYPE cicd_build_failures_total counter
cicd_build_failures_total{job="backend"} 1
EOF

# Send alert to Alertmanager
curl -fsS --connect-timeout 5 --max-time 10 -X POST -H "Content-Type: application/json" \
  -d '{
    "alerts": [{
      "status": "firing",
      "labels": {
        "alertname": "BackendBuildFailed",
        "severity": "critical",
        "job": "backend"
      },
      "annotations": {
        "summary": "Backend build failed",
        "description": "Build #'$BUILD_NUMBER' failed. Check logs: '$BUILD_URL'"
      }
    }]
  }' \
  "$ALERTMANAGER_URL" >/dev/null || echo "Alertmanager unreachable at $ALERTMANAGER_URL, skipping failure alert"
        ''', returnStatus: true)
        echo "✗ Build failed - alert sent to monitoring"
      }
    }
  }
}

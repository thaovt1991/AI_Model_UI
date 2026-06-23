// Jenkins Pipeline — build Angular AI_Model_UI
// Hỗ trợ cả Windows agent (bat) và Linux agent (sh)
pipeline {
    agent any

    tools {
        // nodejs 'NodeJS-20'
        nodejs 'node 20_19_6'
    }

    parameters {
        string(
            name: 'API_BASE_URL',
            defaultValue: 'http://localhost:5296/api/ai',
            description: 'URL Backend API — ghi vào environment.ts trước khi build'
        )
        choice(
            name: 'BUILD_CONFIG',
            choices: ['production', 'development'],
            description: 'Cấu hình Angular build'
        )
    }

    environment {
        APP_DIR = 'AI_Model_UI'
        DIST_GLOB = 'dist/AI_Model_UI/**/*'
        CI = 'true'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install dependencies') {
            steps {
                dir(env.APP_DIR) {
                    script {
                        if (isUnix()) {
                            sh '''
                                node -v
                                npm -v
                                if [ -f package-lock.json ]; then
                                  npm ci
                                else
                                  echo "WARN: Khong co package-lock.json — dung npm install. Nen commit package-lock.json vao Git."
                                  npm install
                                fi
                            '''
                        } else {
                            bat '''
                                node -v
                                npm -v
                                if exist package-lock.json (
                                  npm ci
                                ) else (
                                  echo WARN: Khong co package-lock.json — dung npm install. Nen commit package-lock.json vao Git.
                                  npm install
                                )
                            '''
                        }
                    }
                }
            }
        }

        stage('Configure API URL') {
            steps {
                dir(env.APP_DIR) {
                    script {
                        if (isUnix()) {
                            sh """
                                sed -i "s|apiBaseUrl:.*|apiBaseUrl: '${params.API_BASE_URL}',|" src/environments/environment.ts
                                cat src/environments/environment.ts
                            """
                        } else {
                            powershell """
                                \$path = 'src/environments/environment.ts'
                                \$content = Get-Content \$path -Raw
                                \$content = \$content -replace 'apiBaseUrl:.*', "apiBaseUrl: '${params.API_BASE_URL}',"
                                Set-Content -Path \$path -Value \$content -Encoding UTF8
                                Get-Content \$path
                            """
                        }
                    }
                }
            }
        }

        stage('Build Angular') {
            steps {
                dir(env.APP_DIR) {
                    script {
                        if (isUnix()) {
                            sh "npm run build -- --configuration=${params.BUILD_CONFIG}"
                        } else {
                            bat "npm run build -- --configuration=${params.BUILD_CONFIG}"
                        }
                    }
                }
            }
        }

        stage('Archive artifact') {
            steps {
                dir(env.APP_DIR) {
                    archiveArtifacts artifacts: "${env.DIST_GLOB}", fingerprint: true
                }
            }
        }
    }

    post {
        success {
            echo "Build UI thành công. Artifact: ${env.APP_DIR}/dist/AI_Model_UI"
        }
        failure {
            echo 'Build UI thất bại — xem log các stage trước đó.'
        }
    }
}

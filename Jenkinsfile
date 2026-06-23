// Jenkins Pipeline — build Angular AI_Model_UI (Windows + Linux)
pipeline {
    agent any

    tools {
        nodejs 'node 20_19_6'
    }

    parameters {
        string(
            name: 'API_BASE_URL',
            defaultValue: 'http://localhost:5296/api/ai',
            description: 'URL Backend API'
        )
        choice(
            name: 'BUILD_CONFIG',
            choices: ['production', 'development'],
            description: 'Cau hinh Angular build'
        )
        string(
            name: 'APP_DIR_OVERRIDE',
            defaultValue: '',
            description: 'De trong = tu dong tim. Hoac nhap: AI_Model_UI hoac . (root repo)'
        )
    }

    environment {
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

        stage('Detect project folder') {
            steps {
                script {
                    echo '--- Noi dung thu muc workspace (root) ---'
                    if (isUnix()) {
                        sh 'ls -la'
                    } else {
                        bat 'dir'
                    }

                    if (params.APP_DIR_OVERRIDE?.trim()) {
                        env.APP_DIR = params.APP_DIR_OVERRIDE.trim()
                    } else if (fileExists('AI_Model_UI/package.json')) {
                        // Monorepo: Job Model AI/AI_Model_UI/package.json
                        env.APP_DIR = 'AI_Model_UI'
                    } else if (fileExists('package.json')) {
                        // Repo chi chua rieng project UI o root
                        env.APP_DIR = '.'
                    } else {
                        if (isUnix()) {
                            sh 'find . -name package.json 2>/dev/null || true'
                        } else {
                            bat 'dir /s /b package.json 2>nul || echo KHONG TIM THAY package.json'
                        }
                        error '''
                            Khong tim thay package.json trong workspace Jenkins.

                            Kiem tra:
                            1. Git repo da push day du thu muc AI_Model_UI (package.json, src, angular.json...)
                            2. Job Jenkins checkout dung branch/repo
                            3. Hoac set parameter APP_DIR_OVERRIDE neu duong dan khac
                        '''
                    }

                    env.DIST_GLOB = 'dist/AI_Model_UI/**/*'
                    echo "Se build trong thu muc: ${env.APP_DIR}"
                }
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
                                if [ -f package-lock.json ]; then npm ci; else npm install; fi
                            '''
                        } else {
                            bat '''
                                node -v
                                npm -v
                                if exist package-lock.json (npm ci) else (npm install)
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
                            """
                        } else {
                            powershell """
                                \$path = 'src/environments/environment.ts'
                                \$content = Get-Content \$path -Raw
                                \$content = \$content -replace 'apiBaseUrl:.*', "apiBaseUrl: '${params.API_BASE_URL}',"
                                Set-Content -Path \$path -Value \$content -Encoding UTF8
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
            echo "Build UI thanh cong: ${env.APP_DIR}/dist/AI_Model_UI"
        }
        failure {
            echo 'Build that bai — xem stage Detect project folder de biet workspace co gi.'
        }
    }
}

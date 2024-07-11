# Setup services
cd coturn
source ./setup.sh
cd ..
cd nginx
source ./setup.sh
cd ..

# Setup app
if [ ! `command -v node` ] && [ ! `command -v npm` ]; then
    sudo apt-get install nodejs npm
fi

# Update .envs
COTURN_AUTH_SECRET=$(sudo grep "static-auth-secret" /etc/turnserver.conf | cut -d'=' -f2)
sed -i "s/TURN_SECRET=.*/TURN_SECRET=$COTURN_AUTH_SECRET/g" .env

npm install
node index.js
# Setup services
cd coturn
source ./setup.sh
cd ..
cd nginx
source ./nginx/setup.sh
cd ..

# Run app
sudo apt-get install nodejs npm
npm install
node index.js
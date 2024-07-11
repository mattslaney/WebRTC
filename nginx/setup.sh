# Setup reverse proxy
sudo apt-get update
sudo apt-get install nginx

# Generate a self signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 3650 -nodes -subj "/C=XX/ST=StateName/L=CityName/O=CompanyName/OU=CompanySectionName/CN=CommonNameOrHostname"
sudo cp *.pem /etc/ssl

# Set up the reverse proxy to the node app
sudo cp webrtc /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/webrtc /etc/nginx/sites-enabled

# Obtain a certificate
## Self Signed
# openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 365
## Self Signed - One Command
# sudo openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 3650 -nodes -subj "/C=XX/ST=StateName/L=CityName/O=CompanyName/OU=CompanySectionName/CN=CommonNameOrHostname"
## Real Certificate
if [ -z "$1" ]; then
    read -p "Enter the domain for the certificate: " domainname
else
    domainname=$1
fi
sudo certbot certonly --standalone -d $domainname

# Open HTTP & HTTPS on firewall
sudo iptables -I INPUT -p tcp -m tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp -m tcp --dport 443 -j ACCEPT

sudo systemctl restart nginx.service
if ! command -v nginx &> /dev/null; then
    # Setup reverse proxy
    sudo apt-get update
    sudo apt-get install nginx
fi

if [ ! -e /etc/ssl/cert.pem -o ! -e /etc/ssl/key.pem ]; then
    echo "Generating a certificate"
    # Obtain a certificate
    ## Self Signed
    # openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 365
    # sudo cp *.pem /etc/ssl
    ## Self Signed - One Command
    # sudo openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 3650 -nodes -subj "/C=XX/ST=StateName/L=CityName/O=CompanyName/OU=CompanySectionName/CN=CommonNameOrHostname"
    # sudo cp *.pem /etc/ssl
    ## Real Certificate
    if [ -z "$1" ]; then
        read -p "Enter the domain for the certificate: " domainname
    else
        domainname=$1
    fi
    sudo certbot certonly --standalone -d $domainname
    sudo ln -s "/etc/letsencrypt/live/$domainname/fullchain.pem" /etc/ssl/cert.pem
    sudo ln -s "/etc/letsencrypt/live/$domainname/privkey.pem" /etc/ssl/key.pem
else
    echo "Using existing certificate"
fi

# Set up the reverse proxy to the node app
sudo cp webrtc /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/webrtc /etc/nginx/sites-enabled

# Open HTTP & HTTPS on firewall
sudo iptables -I INPUT -p tcp -m tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp -m tcp --dport 443 -j ACCEPT

sudo systemctl restart nginx.service
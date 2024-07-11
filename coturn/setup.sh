# Install coturn
if ! command -v nginx &> /dev/null; then
    sudo apt-get update -y
    sudo apt-get install coturn
fi

# Configure coturn
sudo mv /etc/turnserver.conf /etc/turnserver.conf.backup
sudo cp turnserver.conf /etc/turnserver.conf

# Update IPs in config
private_ip=$(ip route get 1 | awk '{print $7}')
public_ip=$(curl ifconfig.me)
sudo sed -i "s/PRIVATE_IP/$private_ip/g" /etc/turnserver.conf
sudo sed -i "s/PUBLIC_IP/$public_ip/g" /etc/turnserver.conf

if [ -z "$1" ]; then
    read -p "Enter the coturn auth secret: " secret
else
    secret=$1
fi
sudo sed -i "s/COTURN_AUTH_SECRET/$secret/g" /etc/turnserver.conf

# Open firewall
sudo iptables -I INPUT -p tcp -m tcp --dport 3478 -j ACCEPT
sudo iptables -I INPUT -p udp -m udp --dport 3478 -j ACCEPT
sudo iptables -I INPUT -p udp -m udp --dport 49152:65535 -j ACCEPT

# Restart service
sudo systemctl restart coturn.service
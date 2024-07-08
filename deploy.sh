#
# $1 = private_key_path
# $2 = username@server
#
rsync -avzP --exclude node_modules -e "ssh -i \"$1\"" . $2:~/WebRTC
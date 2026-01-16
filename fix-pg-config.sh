#!/bin/bash
# Remove all corrupted listen_addresses lines
sudo sed -i '/listen_addresses/d' /etc/postgresql/17/main/postgresql.conf

# Add correct listen_addresses at the end
echo "listen_addresses = '*'" | sudo tee -a /etc/postgresql/17/main/postgresql.conf

# Restart PostgreSQL
sudo systemctl restart postgresql@17-main

# Check status
sudo systemctl status postgresql@17-main

{ pkgs ? import <nixpkgs> {} }:
(pkgs.buildFHSEnv {
  name = "soulseek-cli";
  targetPkgs = pkgs: (with pkgs; [
    nodejs_24
    libsecret
    glib
    gnome-keyring
    pkg-config
  ]);
  runScript = "bash";
  profile = ''
    echo "soulseek-cli dev environment"
    echo "Run: npm install && node ./cli.js"
  '';
}).env

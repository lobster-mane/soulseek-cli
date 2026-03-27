{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_24
    libsecret
    gnome-keyring
  ];
  shellHook = ''
    export LD_LIBRARY_PATH="${pkgs.libsecret}/lib:$LD_LIBRARY_PATH"
    echo "soulseek-cli dev environment"
    echo "Run: npm install && node ./cli.js"
  '';
}

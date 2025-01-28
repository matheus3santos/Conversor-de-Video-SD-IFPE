// src/components/Header.tsx
import styles from "../styles/Header.module.css"; // Ou o caminho correto para o seu arquivo de estilos
import Link from "next/link";

const Header = () => {
  return (
    <header className={styles.header}>
      <nav>
        <ul className={styles.navList}>
          <li>
            <Link href="/">Página Inicial</Link>
          </li>
          <li>
            <Link href="/downloadScreen">Sobre</Link>
          </li>
          <li>
            <Link href="uploadScreen">Conversor</Link>
          </li>
        </ul>
      </nav>
    </header>
  );
};

export default Header;
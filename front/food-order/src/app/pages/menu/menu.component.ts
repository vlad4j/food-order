import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { AngularFireFunctions } from "angularfire2/functions";
import { User } from "firebase";
import { AngularFireDatabase } from "angularfire2/database";
import { AngularFireAuth } from "angularfire2/auth";
import { MenuItem } from "../../model/menu-item";
import { MenuCategory } from "../../model/menu-category";
import * as csv from "csvtojson";

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss']
})
export class MenuComponent implements OnInit, AfterViewInit {
  @ViewChild('fileUploadInput') fileUploadInput: ElementRef;
  @ViewChild('divdiv') divdiv: ElementRef;

  activeUser: User;
  menu: MenuCategory[] = [];
  displayedColumns: string[] = ['name', 'weight', 'price'];
  menuUpdateTimestamp: number;
  updating: boolean = false;

  constructor(fireAuth: AngularFireAuth,
              private fireDb: AngularFireDatabase,
              private fireFunc: AngularFireFunctions) {
    fireAuth.authState.subscribe(user => {
      if (user) {
        this.activeUser = user;
        this.readMenu();
      } else {
        this.activeUser = null;
      }
    });

    this.fireDb.database.ref("/menuUpdateTimestamp").on("value", snapshot => {
      this.menuUpdateTimestamp = snapshot.val();
    });
  }

  updateMenu() {
    this.updating = true;

    this.fireFunc.httpsCallable("loadMenu")(null)
      .subscribe(() => {
        this.readMenu();
        this.updating = false;
      }, () => {
        this.updating = false;
      });
  }

  private readMenu() {
    this.fireDb.database.ref("/menu").once("value", (snapshot) => {
      let menu = snapshot.val();
      console.log("Menu: ", menu);
      if (menu) {
        this.menu = menu;
      }
    });
  }

  private handleFileUploaded(content: string) {
    this.parseMenuFromCsv(content).then((categories) => {
      let menu = [];
      let idCounter = 1;
      Object.keys(categories).forEach(key => {
        let items = categories[key];
        let menuItems = items.map((item) => {
          let weight = parseFloat(item[1].replace(/,/g, ".")) * 1000; // in gramms
          let price = parseFloat(item[2].replace(/-/g, "."));
          return new MenuItem(idCounter++, item[0], weight, price)
        });

        if (menuItems.length) {
          menu.push(new MenuCategory(key, menuItems));
        }
      });
      console.log(menu);
      this.menu = menu;
    });
  }

  private parseMenuFromCsv(content: string): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      let records = [];
      csv({
        noheader: true,
        trim: true,
      }).fromString(content)
        .subscribe((data, lineNumber) => {
          records.push(data);
        }, (err) => {
          console.error(err);
          reject(err);
        }, () => {

          resolve(this.getCategories(records));
        });
    });
  }

  private getCategories(records: any[]) {
    let categories = {};
    let lastCategory = "";
    records.forEach((line, index) => {
      if (index < 5) {
        return; // skip first 5
      }
      let columns = [
        MenuComponent.cleanString(line.field1),
        MenuComponent.cleanString(line.field2),
        MenuComponent.cleanString(line.field3)
      ];

      console.log(index, columns);

      if (!columns[0]) {
        return; // skip empty lines
      }

      if (columns[0] && !columns[1] && !columns[2]) {
        lastCategory = columns[0];
        categories[lastCategory] = [];
      } else {
        categories[lastCategory].push(columns);
      }
    });
    return categories;
  }

  private splitScvLine(line: string): string[] {
    let results = [];
    let activeLine = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      let char = line[i];

      if (char === "," && !inQuote) {
        results.push(this.normalizeString(activeLine));
        activeLine = "";
      } else {
        activeLine += char;
      }
      if (char === "\"") {
        inQuote = !inQuote;
      }
    }
    results.push(this.normalizeString(activeLine));
    return results;
  }

  private static cleanString(str: string) {
    let result = str.trim();
    result = result.replace(/\n/g, " ");
    return result.trim();
  }

  private normalizeString(str: string) {
    let result = str.trim();
    if (result.startsWith("\"") && result.endsWith("\"")) {
      result = result.substr(1, result.length - 2);
    }
    result = result.replace(/""/g, "\"");
    return result;
  }

  ngAfterViewInit(): void {
    let nativeElement: Element = this.fileUploadInput.nativeElement;
    nativeElement.addEventListener("change", (event) => {
      let target: any = event.target; // specify target type for compiler
      let files = target.files;
      if (files.length) {
        let file = files[0];
        let reader = new FileReader();
        reader.onload = () => {
          this.handleFileUploaded(reader.result);
        };
        reader.readAsText(file);
      }
    })
  }

  ngOnInit() {
  }

}

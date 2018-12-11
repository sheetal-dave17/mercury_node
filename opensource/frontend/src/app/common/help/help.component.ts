import { Component, OnInit } from '@angular/core';
import { ViewItemsService } from '../../view-items/view-items.service';

@Component({
  selector: 'app-help',
  templateUrl: './help.component.html',
  styleUrls: ['./help.component.css']
})
export class HelpComponent {
  constructor(private viewItemsService: ViewItemsService) {
    this.viewItemsService.viewAll().then(res => console.log('allListings', res))
  }

        private visual: any = {
        q1: false,
        q2: false,
        q3: false,
        q4: false,
        q5: false,
        q6: false,
        q7: false,
        q8: false,
        q9: false,
        q10: false,
        q11: false        
    }


}